import { MirrorManager } from './service'
import { SlackClient } from './slack'
;(async () => {
  const slack = await SlackClient.init()
  try {
    const app = new MirrorManager(slack)
    await app.run()
  } catch (error: any) {
    console.error('Application failed:', error.message)
    // Note: Removed shutdown message to reduce noise - errors are reported in the mirror manager
    process.exit(error.code || -1)
  }
})()
