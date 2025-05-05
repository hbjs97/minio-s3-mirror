import { Block, KnownBlock } from '@slack/web-api'
import { BlockMessage } from './block-message'

export class StopMirrorMessage implements BlockMessage {
  readonly fallbackText: string
  readonly blocks: (Block | KnownBlock)[]

  constructor(source: string, destination: string) {
    this.fallbackText = `:white_check_mark: Stop mirror from ${source} to ${destination}`
    this.blocks = [
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: `:white_check_mark: Stop mirror from ${source} to ${destination}`,
          emoji: true,
        },
      },
    ]
  }
}
