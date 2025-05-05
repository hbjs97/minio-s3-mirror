import { MirrorManager } from './service'
import { ShutdownAppMessage, SlackClient, StartAppMessage } from './slack'
;(async () => {
  const slack = await SlackClient.init()
  try {
    await slack?.send(new StartAppMessage())
    const app = new MirrorManager(slack)
    app.run()
  } catch (error: any) {
    await slack?.send(new ShutdownAppMessage(error.code || -1))
    process.exit(error.code || -1)
  }
})()
