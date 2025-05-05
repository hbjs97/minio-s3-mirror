import { ChildProcessWithoutNullStreams } from 'child_process'

export interface MirrorProcess {
  source: string
  destination: string
  process: ChildProcessWithoutNullStreams
}
