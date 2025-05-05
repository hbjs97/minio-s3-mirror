import { Block, KnownBlock } from '@slack/web-api'

export interface BlockMessage {
  readonly fallbackText: string
  readonly blocks: (KnownBlock | Block)[]
}
