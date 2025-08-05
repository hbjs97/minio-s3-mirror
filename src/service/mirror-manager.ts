import { spawn } from 'child_process'
import { Config } from '../config'
import { FailMirrorMessage, SlackClient, StartMirrorMessage, CompleteMirrorMessage } from '../slack'
import { MirrorOptionsBuilder } from '../model'

export class MirrorManager {
  private readonly config = new Config()
  private mirrorProcesses: Map<string, ReturnType<typeof spawn>> = new Map()
  private shutdownInProgress = false
  private readonly maxConcurrent = 3  // Limit concurrent mirror operations
  private mirrorStats: Map<string, {
    startTime: number
  }> = new Map()

  constructor(private readonly slack?: SlackClient) {
    this.setupShutdownHandlers()
  }

  public async run(): Promise<void> {
    try {
      // Setup aliases in parallel for faster startup
      await Promise.all([
        this.setupAlias('minio', this.config.minio),
        this.setupAlias('aws', this.config.s3)
      ])
      
      // Validate aliases are working
      console.log('Validating alias connectivity...')
      await Promise.all([
        this.validateAlias('minio'),
        this.validateAlias('aws')
      ])
      
      // Validate buckets exist
      console.log('Validating bucket existence...')
      for (const pair of this.config.bucketPairs) {
        await this.validateBucket(pair.source)
        // Note: We don't validate destination bucket as it might not exist yet
      }
      
      // Check if we have multiple bucket pairs
      if (this.config.bucketPairs.length > 1) {
        console.log(`Starting mirror for ${this.config.bucketPairs.length} bucket pairs...`)
        await this.startMultipleMirrors()
      } else {
        // Single bucket pair (legacy mode)
        await this.startMirrorProcess(this.config.bucket)
      }
    } catch (error: any) {
      console.error(`Mirror manager failed: ${error.message}`)
      await this.shutdown(1)
    }
  }

  private async setupAlias(name: string, config: { url: string; accessKey: string; secretKey: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['alias', 'set', name, config.url, config.accessKey, config.secretKey]
      console.log(`Setting up ${name} alias for ${config.url}...`)
      
      const mc = spawn('mc', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      
      mc.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      mc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      mc.on('close', (code) => {
        if (code === 0) {
          console.log(`Successfully set ${name} alias: ${stdout.trim() || 'OK'}`)
          resolve()
        } else {
          const errorDetail = stderr || stdout || 'Unknown error'
          reject(new Error(`Failed to set ${name} alias (exit code ${code}): ${errorDetail}`))
        }
      })

      mc.on('error', (error) => {
        reject(new Error(`Failed to spawn mc for ${name} alias: ${error.message}`))
      })
    })
  }

  private async validateAlias(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['ls', name]
      console.log(`Testing ${name} alias connectivity...`)
      
      const mc = spawn('mc', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      
      mc.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      mc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      mc.on('close', (code) => {
        if (code === 0) {
          console.log(`✓ ${name} alias is accessible`)
          resolve()
        } else {
          const errorDetail = stderr || stdout || 'Unknown error'
          reject(new Error(`Failed to access ${name} alias: ${errorDetail}`))
        }
      })

      mc.on('error', (error) => {
        reject(new Error(`Failed to validate ${name} alias: ${error.message}`))
      })
    })
  }

  private async validateBucket(bucketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['stat', bucketPath]
      console.log(`Checking bucket: ${bucketPath}...`)
      
      const mc = spawn('mc', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      
      mc.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      mc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      mc.on('close', (code) => {
        if (code === 0) {
          console.log(`✓ Bucket ${bucketPath} exists and is accessible`)
          resolve()
        } else {
          const errorDetail = stderr.trim() || stdout.trim() || 'Unknown error'
          // Extract the actual error message
          const match = errorDetail.match(/Unable to stat.*?`(.+?)`\.?\s*(.*)/) || 
                        errorDetail.match(/ERROR:\s*(.*)/)
          const cleanError = match ? match[0] : errorDetail
          reject(new Error(`Bucket validation failed: ${cleanError}`))
        }
      })

      mc.on('error', (error) => {
        reject(new Error(`Failed to check bucket ${bucketPath}: ${error.message}`))
      })
    })
  }

  private async startMultipleMirrors(): Promise<void> {
    const bucketPairs = this.config.bucketPairs
    
    // Process bucket pairs in chunks to limit concurrency
    for (let i = 0; i < bucketPairs.length; i += this.maxConcurrent) {
      const chunk = bucketPairs.slice(i, i + this.maxConcurrent)
      
      await Promise.all(
        chunk.map(pair => this.startMirrorProcess(pair))
      )
    }
  }

  private async startMirrorProcess(bucketPair: { source: string; destination: string }): Promise<void> {
    let { source, destination } = bucketPair
    
    // Apply prefix filter if configured (for cost optimization)
    if (this.config.prefix) {
      // Ensure prefix doesn't start with slash
      const cleanPrefix = this.config.prefix.replace(/^\//, '')
      source = `${source}/${cleanPrefix}`
      destination = `${destination}/${cleanPrefix}`
      console.log(`[INFO] Applying prefix filter: ${cleanPrefix}`)
    }
    
    // Build mirror command arguments from config options
    const optionsBuilder = new MirrorOptionsBuilder()
    const options = this.config.mirrorOptions
    
    // Apply only the simplified options
    if (options.exclude) optionsBuilder.withExclude(options.exclude)
    if (options.maxWorkers) optionsBuilder.withMaxWorkers(options.maxWorkers)
    if (options.dryRun) optionsBuilder.withDryRun(options.dryRun)
    
    const args = [...optionsBuilder.toCommandArgs(), source, destination]
    
    // Add debug flag to mc mirror for more verbose output (disabled - too verbose)
    // if (process.env['MIRROR_DEBUG'] === 'true') {
    //   args.splice(-2, 0, '--debug')  // Add --debug before source and destination
    // }
    
    console.log('\n=== Mirror Configuration ===')
    console.log(`Source: ${source}`)
    console.log(`Destination: ${destination}`)
    console.log(`Command: mc ${args.join(' ')}`)
    if (options.exclude) console.log(`Exclude patterns: ${options.exclude.join(', ')}`)
    if (options.dryRun) console.log(`Mode: DRY RUN (no actual transfer)`)
    console.log('===========================\n')
    
    const processKey = `${source}_${destination}`
    
    // Initialize stats for this mirror operation
    this.mirrorStats.set(processKey, {
      startTime: Date.now()
    })
    
    return new Promise<void>(() => {
      const mirrorProcess = spawn('mc', args, {
        stdio: ['ignore', 'pipe', 'pipe']
        // Removed MC_DEBUG env var - too verbose
      })
      
      this.mirrorProcesses.set(processKey, mirrorProcess)

      let progressBuffer = ''

      if (mirrorProcess.stdout) {
        mirrorProcess.stdout.on('data', (data: Buffer) => {
        const rawData = data.toString()
        if (process.env['MIRROR_DEBUG'] === 'true') {
          console.log('[DEBUG] Raw stdout data:', rawData)
        }
        
        progressBuffer += rawData
        const lines = progressBuffer.split('\n')
        progressBuffer = lines.pop() || ''
        
        lines.forEach(line => {
          if (line.trim()) {
            if (process.env['MIRROR_DEBUG'] === 'true') {
              console.log('[DEBUG] Processing line:', line)
            }
            try {
              const progress = JSON.parse(line)
              this.handleProgress(progress)
            } catch (e) {
              // Not JSON, likely informational message
              console.log('[NON-JSON]', line)
            }
          }
        })
        })
      }

      let stderrBuffer = ''
      if (mirrorProcess.stderr) {
        mirrorProcess.stderr.on('data', (data: Buffer) => {
          const stderr = data.toString()
          stderrBuffer += stderr
          
          // Always log stderr in debug mode
          if (process.env['MIRROR_DEBUG'] === 'true') {
            console.error(`[DEBUG-STDERR] ${stderr.trim()}`)
          } else if (stderr.toLowerCase().includes('error') || 
                     stderr.toLowerCase().includes('fail')) {
            console.error(`[STDERR] ${stderr.trim()}`)
          }
        })
      }

      if (mirrorProcess) {
        mirrorProcess.on('spawn', async () => {
          console.log('Mirror process spawned successfully')
          if (process.env['MIRROR_DEBUG'] === 'true') {
            console.log('[DEBUG] Process PID:', mirrorProcess.pid)
            console.log('[DEBUG] Command args:', args)
          }
          await this.slack?.send(new StartMirrorMessage(source, destination))
          
          // Add periodic status check for long-running operations
          if (process.env['MIRROR_DEBUG'] === 'true') {
            const statusTimer = setInterval(() => {
              const stats = this.mirrorStats.get(processKey)
              if (stats) {
                const elapsed = Date.now() - stats.startTime
                console.log(`[DEBUG] Status check - Elapsed: ${Math.floor(elapsed/1000)}s`)
              }
            }, 30000) // Every 30 seconds
            
            // Store timer to clean up later
            ;(mirrorProcess as any).statusTimer = statusTimer
          }
        })

        mirrorProcess.on('close', async (code: number | null, signal: NodeJS.Signals | null) => {
          console.log(`Mirror process closed with code: ${code}, signal: ${signal}`)
          
          // Clean up status timer
          if ((mirrorProcess as any).statusTimer) {
            clearInterval((mirrorProcess as any).statusTimer)
          }
          
          // Display stderr buffer on error
          if (code !== 0 && stderrBuffer) {
            console.error(`\nMirror command failed with error:\n${stderrBuffer}\n`)
          }
          
          // Send completion message if successful
          if (code === 0 && !this.shutdownInProgress) {
            const stats = this.mirrorStats.get(processKey)
            if (stats && this.slack) {
              const duration = Date.now() - stats.startTime
              
              await this.slack.send(new CompleteMirrorMessage(
                source,
                destination,
                {
                  duration: duration
                }
              ))
            }
          }
          
          // Clean up stats
          this.mirrorStats.delete(processKey)
          
          if (!this.shutdownInProgress) {
            await this.shutdown(code || 0)
          }
        })

        mirrorProcess.on('error', async (error: Error) => {
          console.error(`Mirror process error: ${error.message}`)
          await this.slack?.send(new FailMirrorMessage(source, destination, error.message))
          if (!this.shutdownInProgress) {
            await this.shutdown(1)
          }
        })
      }

      // Set a timeout for the mirror operation (cronjob safety)
      setTimeout(async () => {
        const process = this.mirrorProcesses.get(processKey)
        if (process && !this.shutdownInProgress) {
          console.error(`Mirror operation for ${source} → ${destination} timed out after 30 minutes`)
          process.kill('SIGTERM')
          this.mirrorProcesses.delete(processKey)
        }
      }, 1800000) // 30 minutes
    })
  }

  private handleProgress(progress: any): void {
    // Handle progress updates from mc mirror --json output
    // Note: We only log what mc mirror reports, but don't track unreliable statistics
    try {
      // Debug mode - show raw JSON
      if (process.env['MIRROR_DEBUG'] === 'true') {
        console.log('[DEBUG] Raw JSON:', JSON.stringify(progress))
      }
      
      // Handle different message types from mc mirror (for logging only)
      if (progress.status === 'error') {
        // Extract error message properly
        const errorMsg = progress.errorMessage || 
                        progress.error?.message || 
                        progress.error?.error || 
                        (typeof progress.error === 'string' ? progress.error : JSON.stringify(progress.error))
        const source = progress.source || progress.Source || progress.path || 'unknown'
        console.error(`[✗] Failed to mirror: ${source} - ${errorMsg}`)
      } else if (progress.status === 'success') {
        const target = progress.target || progress.Target || progress.path
        console.log(`[✓] Successfully mirrored: ${target}`)
      } else if (progress.status === 'skip' || progress.action === 'skip') {
        // File was scanned but skipped (already up to date)
        if (process.env['MIRROR_DEBUG'] === 'true') {
          const path = progress.source || progress.Source || progress.path
          console.log(`[SKIP] Already up to date: ${path}`)
        }
      } else if (progress.source && progress.target) {
        console.log(`[SYNC] ${progress.source} → ${progress.target}`)
      } else if (progress.Source && progress.Target) {
        // Alternative field names
        console.log(`[SYNC] ${progress.Source} → ${progress.Target}`)
      } else if (progress.totalSize && progress.totalCount) {
        console.log(`[INFO] Progress: ${progress.totalCount} files, ${this.formatBytes(progress.totalSize)}`)
      } else if (progress.message) {
        console.log(`[INFO] ${progress.message}`)
      } else {
        // Unknown message format - show in debug mode
        if (process.env['MIRROR_DEBUG'] === 'true') {
          console.log('[DEBUG] Unknown message format:', JSON.stringify(progress))
        }
      }
    } catch (e) {
      console.error('[ERROR] Failed to parse progress:', e, 'Raw data:', progress)
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  private setupShutdownHandlers(): void {
    const shutdownHandler = async (signal: string) => {
      console.log(`Received ${signal}, initiating graceful shutdown...`)
      await this.shutdown(0)
    }

    process.on('SIGINT', () => shutdownHandler('SIGINT'))
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'))
    
    process.on('uncaughtException', async (error: Error) => {
      console.error('Uncaught exception:', error)
      await this.shutdown(1)
    })

    process.on('unhandledRejection', async (reason: unknown, promise: Promise<unknown>) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason)
      await this.shutdown(1)
    })
  }

  private async shutdown(exitCode: number): Promise<void> {
    if (this.shutdownInProgress) {
      return
    }
    
    this.shutdownInProgress = true
    console.log('Starting graceful shutdown...')

    try {
      // Stop all mirror processes gracefully
      if (this.mirrorProcesses.size > 0) {
        console.log(`Stopping ${this.mirrorProcesses.size} mirror processes...`)
        
        const killPromises = Array.from(this.mirrorProcesses.entries()).map(async ([key, process]) => {
          if (!process.killed) {
            console.log(`Stopping mirror process for ${key}...`)
            process.kill('SIGTERM')
          }
        })
        
        await Promise.all(killPromises)
        
        // Give them 5 seconds to terminate gracefully
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        // Force kill any remaining processes
        for (const [key, process] of this.mirrorProcesses.entries()) {
          if (!process.killed) {
            console.log(`Force killing mirror process for ${key}...`)
            process.kill('SIGKILL')
          }
        }
        
        this.mirrorProcesses.clear()
      }

      // Note: Shutdown notification removed to reduce noise
      // Success/failure messages are already sent per operation

      console.log(`Shutdown complete, exiting with code ${exitCode}`)
    } catch (error) {
      console.error('Error during shutdown:', error)
    } finally {
      process.exit(exitCode)
    }
  }
}
