export function createFileCache() {
  const cache = new Map<string, { ast: any; hash: string }>();
  
  return {
    get: (key: string) => cache.get(key),
    set: (key: string, value: { ast: any; hash: string }) => cache.set(key, value),
    clear: () => cache.clear(),
    delete: (key: string) => cache.delete(key),
    has: (key: string) => cache.has(key)
  };
}