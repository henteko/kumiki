import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Voice } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

export interface CacheKey {
  text: string;
  voice?: Voice;
}

export class NarrationCacheService {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.cwd(), '.kumiki-cache', 'narration');
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

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      
      await Promise.all(
        files
          .filter(file => file.endsWith('.wav'))
          .map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      
      logger.info('Narration cache cleared');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getCacheStats(): Promise<{ count: number; size: number }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      let count = 0;
      
      for (const file of files) {
        if (file.endsWith('.wav')) {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          count++;
        }
      }
      
      return { count, size: totalSize };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { count: 0, size: 0 };
      }
      throw error;
    }
  }
}

// Singleton instance
export const narrationCacheService = new NarrationCacheService();