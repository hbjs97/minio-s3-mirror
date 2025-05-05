import { Block, KnownBlock } from '@slack/web-api'
import { BlockMessage } from './block-message'

export class StartMirrorMessage implements BlockMessage {
  readonly fallbackText: string
  readonly blocks: (Block | KnownBlock)[]

  constructor(source: string, destination: string) {
    this.fallbackText = `Start mirror from ${source} to ${destination}`
    this.blocks = [
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: `Start mirror from ${source} to ${destination}`,
          emoji: true,
        },
      },
    ]
  }
}
