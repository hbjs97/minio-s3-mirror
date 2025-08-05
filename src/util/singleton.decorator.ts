// Simplified singleton implementation without Proxy overhead
const instances = new WeakMap<any, any>()

export function Singleton<T extends new (...args: any[]) => any>(target: T): T {
  return class extends target {
    constructor(...args: any[]) {
      const instance = instances.get(target)
      if (instance) {
        return instance
      }
      
      super(...args)
      instances.set(target, this)
    }
  } as T
}
