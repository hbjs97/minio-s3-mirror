import { WebClient } from '@slack/web-api'
import { Config, SlackConfig } from '../config'
import { BlockMessage } from './messages'

export class SlackClient {
  private readonly client: WebClient

  private constructor(private readonly config: SlackConfig) {
    this.client = new WebClient(this.config.botToken)
  }

  static async init(): Promise<SlackClient | undefined> {
    const config = new Config().slack
    if (config) {
      const client = new SlackClient({
        botToken: process.env['SLACK_BOT_TOKEN']!,
        channelId: process.env['SLACK_CHANNEL_ID']!,
      })

      const res = await client.client.auth.test({})
      if (res.ok) {
        console.log('Successfully authenticated with Slack:', res.user)
        return client
      } else {
        console.error('Failed to authenticate with Slack:', res.error)
        process.exit(1)
      }
    }
    return undefined
  }

  async send(message: BlockMessage) {
    const response = await this.client.chat.postMessage({
      channel: this.config.channelId,
      text: message.fallbackText,
      blocks: message.blocks,
    })

    if (!response.ok) {
      console.error('Failed to send message:', response.error)
    }
  }
}
