import { Block, KnownBlock } from '@slack/web-api'
import { Config } from '../../config'
import { BlockMessage } from './block-message'

export class ShutdownAppMessage implements BlockMessage {
  readonly fallbackText: string
  readonly blocks: (Block | KnownBlock)[]
  readonly serviceName = new Config().service

  constructor(exitCode: number) {
    this.fallbackText = `Shutdown [${this.serviceName}] mirror application with exit code ${exitCode}`
    this.blocks = [
      {
        type: 'divider',
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Shutdown [${this.serviceName}] mirror application with exit code ${exitCode}`,
          emoji: true,
        },
      },
    ]
  }
}
