export interface MirrorOptions {
  /**
   * Exclude patterns (glob patterns)
   * Examples: ["*.tmp", "*.log", ".DS_Store"]
   */
  exclude?: string[]

  /**
   * Skip errors and continue mirroring
   * Default: true
   */
  skipErrors?: boolean

  /**
   * Enable JSON output for better progress tracking
   * Default: true
   */
  json?: boolean

  /**
   * Number of concurrent workers for parallel transfers
   * Default: auto-detect
   */
  maxWorkers?: number

  /**
   * Dry run - show what would be transferred without actually doing it
   * Default: false
   */
  dryRun?: boolean
}

export class MirrorOptionsBuilder {
  private options: MirrorOptions = {
    skipErrors: true,
    json: true,
  }

  withExclude(patterns: string[]): this {
    this.options.exclude = patterns
    return this
  }

  withMaxWorkers(count: number): this {
    this.options.maxWorkers = count
    return this
  }

  withDryRun(dryRun: boolean = true): this {
    this.options.dryRun = dryRun
    return this
  }

  build(): MirrorOptions {
    return { ...this.options }
  }

  /**
   * Convert options to mc command arguments
   */
  toCommandArgs(): string[] {
    const args: string[] = ['mirror']

    // Always skip errors for cronjob resilience
    if (this.options.skipErrors !== false) {
      args.push('--skip-errors')
    }

    // Always use JSON for better progress tracking
    if (this.options.json !== false) {
      args.push('--json')
    }


    // Exclude patterns
    if (this.options.exclude?.length) {
      this.options.exclude.forEach(pattern => {
        args.push(`--exclude`, pattern)  // Fixed: removed quotes, mc handles it
      })
    }

    // Parallel workers
    if (this.options.maxWorkers) {
      args.push(`--max-workers=${this.options.maxWorkers}`)  // Fixed: use correct flag
    }

    // Dry run for testing
    if (this.options.dryRun) {
      args.push('--dry-run')
    }

    return args
  }
}