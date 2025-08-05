import { Block, KnownBlock } from '@slack/web-api';
import { BlockMessage } from './block-message';
import { Config } from '../../config';

export class CompleteMirrorMessage implements BlockMessage {
  readonly fallbackText: string;
  readonly blocks: (Block | KnownBlock)[];
  private readonly config = new Config();

  constructor(
    source: string,
    destination: string,
    stats: {
      duration?: number;
    } = {}
  ) {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    this.fallbackText = `미러링 완료: ${source} → ${destination}`;

    const fields = [
      {
        type: 'mrkdwn' as const,
        text: `*완료 시간:*\n${timestamp}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*소스:*\n\`${source}\``,
      },
      {
        type: 'mrkdwn' as const,
        text: `*대상:*\n\`${destination}\``,
      },
    ];

    // Add duration if available
    if (stats.duration !== undefined) {
      fields.push({
        type: 'mrkdwn' as const,
        text: `*소요 시간:*\n${this.formatDuration(stats.duration)}`,
      });
    }


    this.blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ MinIO to S3 미러링 완료',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: fields,
      },
    ];

    // Note: Error counting and performance insights removed 
    // as mc mirror JSON output doesn't provide reliable statistics


    this.blocks.push(
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: this.getCompletionMessage(),
          },
        ],
      },
      {
        type: 'divider',
      }
    );
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분 ${seconds % 60}초`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`;
    } else {
      return `${seconds}초`;
    }
  }

  private getCompletionMessage(): string {
    return '✨ 증분 동기화가 완료되었습니다. 상세한 결과는 로그를 확인해주세요.';
  }
}
