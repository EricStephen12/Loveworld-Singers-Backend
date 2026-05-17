// Stub for ultra-fast-loader
export const ultraFastLoader = {
  preloadData: () => Promise.resolve(),
  getCachedData: () => null,
  clearCache: () => {},
  getPages: async () => {
    return [];
  },
  getSongs: async (pageId: number) => {
    return [];
  },
  getCacheStats: () => {
    return { hits: 0, misses: 0, size: 0 };
  },
  getProfile: async (userId: string) => {
    return null;
  }
};
