import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Voice } from '@/types/index.js';
import { getNarrationCacheDir } from '@/utils/app-dirs.js';
import { logger } from '@/utils/logger.js';

export interface CacheKey {
  text: string;
  voice?: Voice;
}

export class NarrationCacheService {
  private cacheDir: string;
  private initialized = false;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || getNarrationCacheDir();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.ensureCacheDir();
    this.initialized = true;
  }

  async ensureCacheDir(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  generateCacheKey(key: CacheKey): string {
    const content = JSON.stringify({
      text: key.text,
      voice: key.voice || {},
    });
    
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  getCachePath(key: CacheKey): string {
    const hash = this.generateCacheKey(key);
    return path.join(this.cacheDir, `${hash}.wav`);
  }

  async exists(key: CacheKey): Promise<boolean> {
    const cachePath = this.getCachePath(key);
    try {
      await fs.access(cachePath);
      return true;
    } catch {
      return false;
    }
  }

  async get(key: CacheKey): Promise<string | null> {
    const cachePath = this.getCachePath(key);
    
    if (await this.exists(key)) {
      logger.debug('Narration cache hit', { 
        text: key.text.substring(0, 50) + '...',
        cachePath 
      });
      return cachePath;
    }
    
    logger.debug('Narration cache miss', { 
      text: key.text.substring(0, 50) + '...',
      cachePath 
    });
    return null;
  }

  async set(key: CacheKey, audioPath: string): Promise<string> {
    await this.ensureCacheDir();
    
    const cachePath = this.getCachePath(key);
    
    // Copy audio file to cache
    await fs.copyFile(audioPath, cachePath);
    
    logger.debug('Narration cached', { 
      text: key.text.substring(0, 50) + '...',
      cachePath 
    });
    
    return cachePath;
  }

  async clear(options?: { olderThan?: number }): Promise<number> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const wavFilePaths = files
        .filter(file => file.endsWith('.wav'))
        .map(file => path.join(this.cacheDir, file));

      let filesToDelete = wavFilePaths;

      if (options?.olderThan) {
        const olderThanMs = options.olderThan;
        const statPromises = wavFilePaths.map(async (filePath) => {
          const stats = await fs.stat(filePath);
          const age = Date.now() - stats.mtimeMs;
          return age > olderThanMs ? filePath : null;
        });
        const results = await Promise.all(statPromises);
        filesToDelete = results.filter((file): file is string => file !== null);
      }

      await Promise.all(filesToDelete.map(filePath => fs.unlink(filePath)));

      const clearedCount = filesToDelete.length;
      logger.info(`Narration cache cleared: ${clearedCount} files`);
      return clearedCount;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      return 0;
    }
  }

  async getStats(): Promise<{ totalFiles: number; totalSize: number }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const wavFiles = files.filter(file => file.endsWith('.wav'));
      
      const statsPromises = wavFiles.map(file => 
        fs.stat(path.join(this.cacheDir, file))
      );
      const statsArray = await Promise.all(statsPromises);
      
      const totalSize = statsArray.reduce((sum, stats) => sum + stats.size, 0);
      
      return { totalFiles: wavFiles.length, totalSize };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { totalFiles: 0, totalSize: 0 };
      }
      throw error;
    }
  }

  async getStatus(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const wavFiles = files.filter(file => file.endsWith('.wav'));

      if (wavFiles.length === 0) {
        return { totalFiles: 0, totalSize: 0 };
      }

      const statsPromises = wavFiles.map(file => fs.stat(path.join(this.cacheDir, file)));
      const statsArray = await Promise.all(statsPromises);

      let totalSize = 0;
      let oldestTime: number | null = null;
      let newestTime: number | null = null;

      for (const stats of statsArray) {
        totalSize += stats.size;
        const time = stats.mtimeMs;
        if (oldestTime === null || time < oldestTime) {
          oldestTime = time;
        }
        if (newestTime === null || time > newestTime) {
          newestTime = time;
        }
      }

      return {
        totalFiles: wavFiles.length,
        totalSize,
        oldestEntry: oldestTime ? new Date(oldestTime) : undefined,
        newestEntry: newestTime ? new Date(newestTime) : undefined,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { totalFiles: 0, totalSize: 0 };
      }
      throw error;
    }
  }
}

// Singleton instance
export const narrationCacheService = new NarrationCacheService();