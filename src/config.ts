import dotenv from 'dotenv'
import { Singleton } from './util'
import { BucketPair } from './model/bucket-pair'

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
  readonly bucket: BucketPair
  readonly slack?: SlackConfig

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

    const pair = process.env['BUCKET_PAIR'] as string
    if (!pair) {
      throw new Error('Missing environment variable: BUCKET_PAIR')
    }
    this.bucket = new BucketPair(pair)

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
  }
}
