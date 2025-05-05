export class BucketPair {
  readonly source: string
  readonly destination: string

  /**
   * @param pair - A string in the format "source:destination"
   * @throws Error if the pair is not in the correct format
   */
  constructor(pair: string) {
    const [source, destination] = pair.split(':').map((bucket) => bucket.trim())
    this.validate(source, destination)
    this.source = source
    this.destination = destination
  }

  private validate(source: string, destination: string) {
    if (!source.startsWith('minio/')) {
      throw new Error(`
        Invalid source bucket: ${source}
        Source bucket must start with "minio/"
      `)
    }

    if (!destination.startsWith('aws/')) {
      throw new Error(`
        Invalid destination bucket: ${destination}
        Destination bucket must start with "aws/"
      `)
    }
  }
}
