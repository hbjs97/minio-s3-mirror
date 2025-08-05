import dotenv from 'dotenv'
import { Singleton } from './util'
import { BucketPair, MirrorOptions } from './model'

dotenv.config()

export interface MinIOConfig {
  url: string
  accessKey: string
  secretKey: string
}

export interface S3Config {
  url: string
  accessKey: string
  secretKey: string
}

export interface SlackConfig {
  botToken: string
  channelId: string
}

@Singleton
export class Config {
  readonly service: string
  readonly minio: MinIOConfig
  readonly s3: S3Config
  readonly bucket: BucketPair  // Legacy single bucket pair
  readonly bucketPairs: BucketPair[]  // Support for multiple bucket pairs
  readonly slack?: SlackConfig
  readonly mirrorOptions: MirrorOptions
  readonly debug: boolean
  readonly prefix?: string

  constructor() {
    this.service = process.env['SERVICE'] || 'mirror-manager'

    this.minio = {
      url: process.env['MINIO_URL']!,
      accessKey: process.env['MINIO_ACCESS_KEY']!,
      secretKey: process.env['MINIO_SECRET_KEY']!,
    }

    this.s3 = {
      url: process.env['AWS_URL']!,
      accessKey: process.env['AWS_ACCESS_KEY']!,
      secretKey: process.env['AWS_SECRET_KEY']!,
    }

    // Support both single BUCKET_PAIR and multiple BUCKET_PAIRS
    const singlePair = process.env['BUCKET_PAIR']
    const multiplePairs = process.env['BUCKET_PAIRS']
    
    if (!singlePair && !multiplePairs) {
      throw new Error('Missing environment variable: BUCKET_PAIR or BUCKET_PAIRS')
    }
    
    // Parse bucket pairs
    if (multiplePairs) {
      // Support multiple pairs separated by semicolon
      // Example: "minio/bucket1:aws/bucket1;minio/bucket2:aws/bucket2"
      this.bucketPairs = multiplePairs
        .split(';')
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => new BucketPair(p))
      
      // Set the first pair as the default for backward compatibility
      this.bucket = this.bucketPairs[0]
    } else {
      // Legacy single pair support
      this.bucket = new BucketPair(singlePair!)
      this.bucketPairs = [this.bucket]
    }

    if (process.env['SLACK_BOT_TOKEN'] && process.env['SLACK_CHANNEL_ID']) {
      this.slack = {
        botToken: process.env['SLACK_BOT_TOKEN'],
        channelId: process.env['SLACK_CHANNEL_ID'],
      }
    } else {
      console.warn(`
        #####################################################################
        Slack configuration is missing. Slack notifications will be disabled.
        #####################################################################
      `)
    }

    // Configure simplified mirror options for cronjob usage
    this.mirrorOptions = {
      skipErrors: process.env['MIRROR_SKIP_ERRORS'] !== 'false',  // Default: true
      json: true,  // Always use JSON for better progress tracking
      exclude: process.env['MIRROR_EXCLUDE']?.split(',').map(s => s.trim()).filter(Boolean),
      maxWorkers: process.env['MIRROR_MAX_WORKERS'] ? parseInt(process.env['MIRROR_MAX_WORKERS']) : undefined,
      dryRun: process.env['MIRROR_DRY_RUN'] === 'true',  // Default: false
    }
    
    // Debug mode for troubleshooting
    this.debug = process.env['MIRROR_DEBUG'] === 'true'
    if (this.debug) {
      console.log('[DEBUG] Debug mode enabled - will show detailed mc output')
    }
    
    // Prefix for cost optimization (e.g., '2025/01/22' for date-based prefixes)
    this.prefix = process.env['MIRROR_PREFIX']
    if (this.prefix) {
      console.log(`[INFO] Using prefix filter: ${this.prefix}`)
    }
  }
}
