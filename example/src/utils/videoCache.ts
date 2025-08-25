// Video caching utility similar to Primal's implementation
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

const CACHE_DIR = `${RNFS.CachesDirectoryPath}/video_cache`;
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB max cache
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export class VideoCache {
  private static instance: VideoCache;
  private isInitialized = false;

  static getInstance(): VideoCache {
    if (!VideoCache.instance) {
      VideoCache.instance = new VideoCache();
    }
    return VideoCache.instance;
  }

  private async initialize() {
    if (this.isInitialized) return;

    try {
      const exists = await RNFS.exists(CACHE_DIR);
      if (!exists) {
        await RNFS.mkdir(CACHE_DIR);
      }
      this.isInitialized = true;
    } catch (error) {
      console.warn('VideoCache: Failed to initialize cache directory:', error);
    }
  }

  private getFileName(url: string): string {
    // Create a simple hash-like filename from URL
    const hash = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const extension = url.split('.').pop()?.toLowerCase() || 'mp4';
    return `${hash}.${extension}`;
  }

  private getFilePath(url: string): string {
    return `${CACHE_DIR}/${this.getFileName(url)}`;
  }

  async getCachedVideoPath(url: string): Promise<string | null> {
    await this.initialize();

    try {
      const filePath = this.getFilePath(url);
      const exists = await RNFS.exists(filePath);

      if (exists) {
        // Check if file is not expired
        const stat = await RNFS.stat(filePath);
        const age = Date.now() - new Date(stat.mtime).getTime();

        if (age < CACHE_EXPIRY) {
          console.log('VideoCache: Using cached video for', url);
          return Platform.OS === 'android' ? `file://${filePath}` : filePath;
        } else {
          // File expired, delete it
          await RNFS.unlink(filePath);
        }
      }
    } catch (error) {
      console.warn('VideoCache: Error checking cached video:', error);
    }

    return null;
  }

  async cacheVideo(url: string): Promise<string | null> {
    await this.initialize();

    try {
      const filePath = this.getFilePath(url);

      // Don't cache if already exists and valid
      const cachedPath = await this.getCachedVideoPath(url);
      if (cachedPath) {
        return cachedPath;
      }

      console.log('VideoCache: Downloading and caching video from', url);

      // Download the video
      const downloadResult = await RNFS.downloadFile({
        fromUrl: url,
        toFile: filePath,
        discretionary: true,
        cacheable: true,
      }).promise;

      if (downloadResult.statusCode === 200) {
        console.log('VideoCache: Video cached successfully');
        await this.cleanupOldCache();
        return Platform.OS === 'android' ? `file://${filePath}` : filePath;
      } else {
        console.warn(
          'VideoCache: Failed to download video, status:',
          downloadResult.statusCode
        );
      }
    } catch (error) {
      console.warn('VideoCache: Error caching video:', error);
    }

    return null;
  }

  private async cleanupOldCache() {
    try {
      const files = await RNFS.readDir(CACHE_DIR);
      let totalSize = 0;

      // Calculate total cache size and sort files by modification time
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const stat = await RNFS.stat(file.path);
          totalSize += stat.size;
          return {
            path: file.path,
            size: stat.size,
            mtime: new Date(stat.mtime).getTime(),
          };
        })
      );

      // If cache is too large, delete oldest files
      if (totalSize > MAX_CACHE_SIZE) {
        console.log('VideoCache: Cache size exceeded, cleaning up old files');
        const sortedFiles = fileStats.sort((a, b) => a.mtime - b.mtime);
        let currentSize = totalSize;

        for (const file of sortedFiles) {
          if (currentSize <= MAX_CACHE_SIZE * 0.8) break; // Keep cache at 80% of max

          await RNFS.unlink(file.path);
          currentSize -= file.size;
          console.log('VideoCache: Deleted old cached file:', file.path);
        }
      }
    } catch (error) {
      console.warn('VideoCache: Error during cache cleanup:', error);
    }
  }

  async clearCache(): Promise<void> {
    try {
      await RNFS.unlink(CACHE_DIR);
      await RNFS.mkdir(CACHE_DIR);
      console.log('VideoCache: Cache cleared');
    } catch (error) {
      console.warn('VideoCache: Error clearing cache:', error);
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      const files = await RNFS.readDir(CACHE_DIR);
      let totalSize = 0;

      for (const file of files) {
        const stat = await RNFS.stat(file.path);
        totalSize += stat.size;
      }

      return totalSize;
    } catch (error) {
      console.warn('VideoCache: Error calculating cache size:', error);
      return 0;
    }
  }
}

export const videoCache = VideoCache.getInstance();
