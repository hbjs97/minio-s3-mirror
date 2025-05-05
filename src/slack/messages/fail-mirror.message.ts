import { Block, KnownBlock } from '@slack/web-api'
import { BlockMessage } from './block-message'

export class FailMirrorMessage implements BlockMessage {
  readonly fallbackText: string
  readonly blocks: (Block | KnownBlock)[]

  constructor(source: string, destination: string, message: string) {
    this.fallbackText = `:error: Failed to mirror from ${source} to ${destination}`
    this.blocks = [
      {
        type: 'divider',
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:error: Failed to mirror from ${source} to ${destination}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `error: ${message}`,
        },
      },
    ]
  }
}
