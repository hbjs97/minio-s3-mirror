import { execSync, spawn } from 'child_process'
import { Config } from '../config'
import { FailMirrorMessage, SlackClient, StartMirrorMessage } from '../slack'

export class MirrorManager {
  private readonly config = new Config()

  constructor(private readonly slack?: SlackClient) {}

  public run(): void {
    const minioAliasCmd = `mc alias set minio ${this.config.minio.url} ${this.config.minio.accessKey} ${this.config.minio.secretKey}`
    const awsAliasCmd = `mc alias set aws ${this.config.s3.url} ${this.config.s3.accessKey} ${this.config.s3.secretKey}`

    try {
      execSync(minioAliasCmd)
    } catch (error: any) {
      console.error(`Error setting MinIO alias: ${error.message}`)
      throw new Error(`Error setting MinIO alias: ${error.message}`)
    }

    try {
      execSync(awsAliasCmd)
    } catch (error: any) {
      console.error(`Error setting AWS alias: ${error.message}`)
      throw new Error(`Error setting AWS alias: ${error.message}`)
    }

    const { source, destination } = this.config.bucket
    try {
      const mc = spawn('mc', ['mirror', '--skip-errors', '--newer-than=3d', source, destination], {
        stdio: 'inherit',
        timeout: 1800000,
      })

      mc.on('spawn', () => {
        console.log('Process spawned')
        this.slack?.send(new StartMirrorMessage(source, destination))
      })

      mc.on('close', (code, signal) => {
        console.log(`Process closed with code: ${code}, signal: ${signal}`)
        process.exit(code)
      })

      mc.on('disconnect', () => {
        console.log('Process disconnected from parent')
        process.exit(1)
      })

      mc.on('error', (error) => {
        console.error(`Mirror process failed with error: ${error.message}`)
        process.exit(1)
      })

      mc.on('exit', (code, signal) => {
        console.log(`Process exited with code: ${code}, signal: ${signal}`)
        process.exit(code)
      })
    } catch (error: any) {
      this.slack?.send(new FailMirrorMessage(source, destination, error.message))
      console.error(`Error running mirror command: ${error.message}`)
      throw new Error(`Error running mirror command: ${error.message}`)
    }
  }
}
