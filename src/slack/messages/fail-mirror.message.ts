import { Block, KnownBlock } from '@slack/web-api'
import { BlockMessage } from './block-message'

export class FailMirrorMessage implements BlockMessage {
  readonly fallbackText: string
  readonly blocks: (Block | KnownBlock)[]

  constructor(source: string, destination: string, message: string) {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    this.fallbackText = `미러링 실패: ${source} → ${destination}`
    
    this.blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ MinIO to S3 미러링 실패',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*발생 시간:*\n${timestamp}`
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
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*오류 내용:*\n\`\`\`${message}\`\`\``
        }
      }
    ]

    // Add error-specific troubleshooting guide
    const troubleshootingGuide = this.getTroubleshootingGuide(message)
    if (troubleshootingGuide) {
      this.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: troubleshootingGuide
        }
      })
    }

    // Add quick actions
    const quickActions = this.getQuickActions(message)
    if (quickActions.length > 0) {
      this.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🔧 권장 조치:*'
        }
      })
      
      quickActions.forEach(action => {
        this.blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• ${action}`
          }
        })
      })
    }

    this.blocks.push(
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '⚠️ 미러링 프로세스가 중단되었습니다. 문제 해결 후 다시 시도해주세요.'
          }
        ]
      },
      {
        type: 'divider',
      }
    )
  }

  private getTroubleshootingGuide(errorMessage: string): string | null {
    const lowerMessage = errorMessage.toLowerCase()
    
    if (lowerMessage.includes('access denied') || lowerMessage.includes('403')) {
      return '🔐 *권한 문제:* AWS IAM 정책에서 S3 버킷에 대한 읽기/쓰기 권한을 확인하세요.'
    }
    
    if (lowerMessage.includes('bucket does not exist') || lowerMessage.includes('nosuchbucket')) {
      return '🪣 *버킷 없음:* 대상 S3 버킷이 존재하지 않습니다. 버킷을 먼저 생성하거나 버킷 이름을 확인하세요.'
    }
    
    if (lowerMessage.includes('unable to stat') || lowerMessage.includes('not found')) {
      return '📁 *소스 없음:* 소스 버킷 또는 경로가 존재하지 않습니다. MinIO 연결과 버킷 이름을 확인하세요.'
    }
    
    if (lowerMessage.includes('connection refused') || lowerMessage.includes('timeout')) {
      return '🌐 *연결 실패:* MinIO 또는 S3 엔드포인트에 연결할 수 없습니다. 네트워크 연결과 URL을 확인하세요.'
    }
    
    if (lowerMessage.includes('invalid credentials') || lowerMessage.includes('signature')) {
      return '🔑 *인증 실패:* Access Key 또는 Secret Key가 올바르지 않습니다. 자격 증명을 확인하세요.'
    }
    
    if (lowerMessage.includes('disk space') || lowerMessage.includes('quota exceeded')) {
      return '💾 *저장공간 부족:* 대상 저장소의 용량이 부족합니다. 공간을 확보하거나 할당량을 늘리세요.'
    }
    
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('throttl')) {
      return '⏱️ *속도 제한:* AWS API 요청 한도에 도달했습니다. 잠시 후 다시 시도하거나 동시 작업 수를 줄이세요.'
    }
    
    return null
  }

  private getQuickActions(errorMessage: string): string[] {
    const actions: string[] = []
    const lowerMessage = errorMessage.toLowerCase()
    
    // General actions
    actions.push('로그 전체 내용 확인: `docker logs <container-id>`')
    
    // Error-specific actions
    if (lowerMessage.includes('access denied') || lowerMessage.includes('403')) {
      actions.push('IAM 정책 확인: S3 버킷에 대한 `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` 권한 필요')
      actions.push('버킷 정책 확인: 크로스 계정 접근인 경우 버킷 정책도 확인')
    }
    
    if (lowerMessage.includes('connection') || lowerMessage.includes('timeout')) {
      actions.push('네트워크 연결 테스트: `mc alias set test <URL> <ACCESS_KEY> <SECRET_KEY>`')
      actions.push('방화벽/보안그룹 확인: MinIO(9000) 및 S3(443) 포트 개방 여부')
    }
    
    if (lowerMessage.includes('bucket does not exist')) {
      actions.push('S3 버킷 생성: `aws s3 mb s3://<bucket-name> --region <region>`')
      actions.push('버킷 이름 규칙 확인: 소문자, 숫자, 하이픈만 사용 가능')
    }
    
    if (lowerMessage.includes('invalid credentials')) {
      actions.push('환경변수 확인: `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`')
      actions.push('자격증명 테스트: `mc ls <alias>` 명령으로 연결 확인')
    }
    
    if (lowerMessage.includes('rate limit')) {
      actions.push('MIRROR_MAX_WORKERS 환경변수를 낮게 설정 (예: 2-3)')
      actions.push('MIRROR_PREFIX 설정으로 스캔 범위 제한')
    }
    
    return actions
  }
}
