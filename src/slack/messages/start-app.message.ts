import { Block, KnownBlock } from '@slack/web-api'
import { Config } from '../../config'
import { BlockMessage } from './block-message'

export class StartAppMessage implements BlockMessage {
  readonly fallbackText: string
  readonly blocks: (Block | KnownBlock)[]
  readonly serviceName = new Config().service

  constructor() {
    this.fallbackText = `:white_check_mark: Start [${this.serviceName}] mirror application`
    this.blocks = [
      {
        type: 'divider',
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:white_check_mark: Start [${this.serviceName}] mirror application`,
          emoji: true,
        },
      },
    ]
  }
}
