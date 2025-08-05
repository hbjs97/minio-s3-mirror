import { Block, KnownBlock } from '@slack/web-api'
import { Config } from '../../config'
import { BlockMessage } from './block-message'

export class StartMirrorMessage implements BlockMessage {
  readonly fallbackText: string
  readonly blocks: (Block | KnownBlock)[]
  readonly config = new Config()

  constructor(source: string, destination: string) {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    const exclude = this.config.mirrorOptions.exclude
    const prefix = this.config.prefix
    
    this.fallbackText = `MinIO → S3 미러링 시작: ${source} → ${destination}`
    
    this.blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚀 MinIO to S3 미러링 시작',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*서비스:*\n${this.config.service || 'minio-s3-mirror'}`
          },
          {
            type: 'mrkdwn',
            text: `*시작 시간:*\n${timestamp}`
          },
          {
            type: 'mrkdwn',
            text: `*소스:*\n\`${source}\``
          },
          {
            type: 'mrkdwn',
            text: `*대상:*\n\`${destination}\``
          }
        ]
      }
    ]

    // Add sync configuration details
    const configFields = []
    
    // Prefix filter (most important for cost optimization)
    if (prefix) {
      configFields.push({
        type: 'mrkdwn' as const,
        text: `*프리픽스 필터:*\n\`${prefix}\` 💰 비용 최적화`
      })
    }
    
    configFields.push({
      type: 'mrkdwn' as const,
      text: `*동기화 범위:*\n전체 파일 (증분 동기화)`
    })
    
    if (exclude && exclude.length > 0) {
      configFields.push({
        type: 'mrkdwn' as const,
        text: `*제외 패턴:*\n${exclude.join(', ')}`
      })
    }

    if (configFields.length > 0) {
      this.blocks.push({
        type: 'section',
        fields: configFields
      })
    }

    this.blocks.push(
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '증분 동기화가 진행됩니다. 변경된 파일만 전송되며, 완료 시 상세 통계와 함께 알림을 받으실 수 있습니다.'
          }
        ]
      },
      {
        type: 'divider',
      }
    )
  }
}
