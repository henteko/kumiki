import { createCommand } from 'commander';

import { imageCache } from '@/services/image-cache.js';
import { logger } from '@/utils/logger.js';

export const cacheCommand = createCommand('cache')
  .description('Manage generated image cache');

// cache status subcommand
cacheCommand
  .command('status')
  .description('Show cache status')
  .action(async () => {
    try {
      await imageCache.initialize();
      const status = await imageCache.getStatus();
      
      logger.info('Cache Status:');
      logger.info(`Total files: ${status.totalFiles}`);
      logger.info(`Total size: ${formatBytes(status.totalSize)}`);
      
      if (status.oldestEntry) {
        logger.info(`Oldest entry: ${status.oldestEntry.toLocaleString()}`);
      }
      if (status.newestEntry) {
        logger.info(`Newest entry: ${status.newestEntry.toLocaleString()}`);
      }
    } catch (error) {
      logger.error('Failed to get cache status', { error });
      process.exit(1);
    }
  });

// cache clear subcommand
cacheCommand
  .command('clear')
  .description('Clear generated image cache')
  .option('--older-than <days>', 'Clear only entries older than specified days')
  .action(async (options: { olderThan?: string }) => {
    try {
      await imageCache.initialize();
      
      let clearOptions;
      if (options.olderThan) {
        const days = parseInt(options.olderThan);
        if (isNaN(days)) {
          logger.error('Invalid days value');
          process.exit(1);
        }
        const olderThan = new Date();
        olderThan.setDate(olderThan.getDate() - days);
        clearOptions = { olderThan };
      }
      
      await imageCache.clear(clearOptions);
      logger.info('Cache cleared successfully');
    } catch (error) {
      logger.error('Failed to clear cache', { error });
      process.exit(1);
    }
  });

// cache size subcommand
cacheCommand
  .command('size')
  .description('Show cache size')
  .action(async () => {
    try {
      await imageCache.initialize();
      const { totalSize, fileCount } = await imageCache.getSize();
      
      logger.info(`Cache size: ${formatBytes(totalSize)}`);
      logger.info(`File count: ${fileCount}`);
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