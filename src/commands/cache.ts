import { createCommand } from 'commander';

import { imageCache } from '@/services/image-cache.js';
import { musicCache } from '@/services/music-cache.js';
import { narrationCacheService } from '@/services/narration-cache.js';
import { logger } from '@/utils/logger.js';

export const cacheCommand = createCommand('cache')
  .description('Manage generated content cache (images, music, and narration)');

// cache status subcommand
cacheCommand
  .command('status')
  .description('Show cache status')
  .option('--type <type>', 'Cache type to show (all, images, music, narration)', 'all')
  .action(async (options: { type: string }) => {
    try {
      const showImages = options.type === 'all' || options.type === 'images';
      const showMusic = options.type === 'all' || options.type === 'music';
      const showNarration = options.type === 'all' || options.type === 'narration';
      
      if (showImages) {
        await imageCache.initialize();
        const imageStatus = await imageCache.getStatus();
        
        logger.info('Image Cache Status:');
        logger.info(`Total files: ${imageStatus.totalFiles}`);
        logger.info(`Total size: ${formatBytes(imageStatus.totalSize)}`);
        
        if (imageStatus.oldestEntry) {
          logger.info(`Oldest entry: ${imageStatus.oldestEntry.toLocaleString()}`);
        }
        if (imageStatus.newestEntry) {
          logger.info(`Newest entry: ${imageStatus.newestEntry.toLocaleString()}`);
        }
      }
      
      if (showMusic) {
        if (showImages) logger.info(''); // Add blank line between sections
        await musicCache.initialize();
        const musicStatus = musicCache.getStats();
        
        logger.info('Music Cache Status:');
        logger.info(`Total files: ${musicStatus.totalFiles}`);
        logger.info(`Total size: ${formatBytes(musicStatus.totalSize)}`);
        
        if (musicStatus.oldestFile) {
          logger.info(`Oldest entry: ${musicStatus.oldestFile.toLocaleString()}`);
        }
        if (musicStatus.newestFile) {
          logger.info(`Newest entry: ${musicStatus.newestFile.toLocaleString()}`);
        }
      }
      
      if (showNarration) {
        if (showImages || showMusic) logger.info(''); // Add blank line between sections
        await narrationCacheService.initialize();
        const narrationStatus = await narrationCacheService.getStatus();
        
        logger.info('Narration Cache Status:');
        logger.info(`Total files: ${narrationStatus.totalFiles}`);
        logger.info(`Total size: ${formatBytes(narrationStatus.totalSize)}`);
        
        if (narrationStatus.oldestEntry) {
          logger.info(`Oldest entry: ${narrationStatus.oldestEntry.toLocaleString()}`);
        }
        if (narrationStatus.newestEntry) {
          logger.info(`Newest entry: ${narrationStatus.newestEntry.toLocaleString()}`);
        }
      }
    } catch (error) {
      logger.error('Failed to get cache status', { error });
      process.exit(1);
    }
  });

// cache clear subcommand
cacheCommand
  .command('clear')
  .description('Clear generated content cache')
  .option('--type <type>', 'Cache type to clear (all, images, music, narration)', 'all')
  .option('--older-than <days>', 'Clear only entries older than specified days')
  .action(async (options: { type: string; olderThan?: string }) => {
    try {
      const clearImages = options.type === 'all' || options.type === 'images';
      const clearMusic = options.type === 'all' || options.type === 'music';
      const clearNarration = options.type === 'all' || options.type === 'narration';
      
      let clearOptions;
      if (options.olderThan) {
        const days = parseInt(options.olderThan);
        if (isNaN(days)) {
          logger.error('Invalid days value');
          process.exit(1);
        }
        clearOptions = { olderThan: days * 24 * 60 * 60 * 1000 }; // Convert to milliseconds
      }
      
      let totalCleared = 0;
      
      if (clearImages) {
        await imageCache.initialize();
        await imageCache.clear(clearOptions?.olderThan ? {
          olderThan: new Date(Date.now() - clearOptions.olderThan)
        } : undefined);
        logger.info('Image cache cleared');
        totalCleared++;
      }
      
      if (clearMusic) {
        await musicCache.initialize();
        const clearedCount = await musicCache.clear(clearOptions);
        logger.info(`Music cache cleared (${clearedCount} files)`);
        totalCleared++;
      }
      
      if (clearNarration) {
        await narrationCacheService.initialize();
        const clearedCount = await narrationCacheService.clear(clearOptions);
        logger.info(`Narration cache cleared (${clearedCount} files)`);
        totalCleared++;
      }
      
      logger.info(`Cache cleared successfully (${totalCleared} cache types)`);
    } catch (error) {
      logger.error('Failed to clear cache', { error });
      process.exit(1);
    }
  });

// cache size subcommand
cacheCommand
  .command('size')
  .description('Show cache size')
  .option('--type <type>', 'Cache type to show (all, images, music, narration)', 'all')
  .action(async (options: { type: string }) => {
    try {
      const showImages = options.type === 'all' || options.type === 'images';
      const showMusic = options.type === 'all' || options.type === 'music';
      const showNarration = options.type === 'all' || options.type === 'narration';
      
      let totalSize = 0;
      let totalFiles = 0;
      
      if (showImages) {
        await imageCache.initialize();
        const imageSize = await imageCache.getSize();
        logger.info(`Image cache size: ${formatBytes(imageSize.totalSize)}`);
        logger.info(`Image file count: ${imageSize.fileCount}`);
        totalSize += imageSize.totalSize;
        totalFiles += imageSize.fileCount;
      }
      
      if (showMusic) {
        if (showImages) logger.info(''); // Add blank line between sections
        await musicCache.initialize();
        const musicStats = musicCache.getStats();
        logger.info(`Music cache size: ${formatBytes(musicStats.totalSize)}`);
        logger.info(`Music file count: ${musicStats.totalFiles}`);
        totalSize += musicStats.totalSize;
        totalFiles += musicStats.totalFiles;
      }
      
      if (showNarration) {
        if (showImages || showMusic) logger.info(''); // Add blank line between sections
        await narrationCacheService.initialize();
        const narrationStats = await narrationCacheService.getStats();
        logger.info(`Narration cache size: ${formatBytes(narrationStats.totalSize)}`);
        logger.info(`Narration file count: ${narrationStats.totalFiles}`);
        totalSize += narrationStats.totalSize;
        totalFiles += narrationStats.totalFiles;
      }
      
      if (options.type === 'all') {
        logger.info(''); // Add blank line before total
        logger.info(`Total cache size: ${formatBytes(totalSize)}`);
        logger.info(`Total file count: ${totalFiles}`);
      }
    } catch (error) {
      logger.error('Failed to get cache size', { error });
      process.exit(1);
    }
  });

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}