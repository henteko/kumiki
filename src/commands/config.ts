import { Command } from 'commander';

import { ConfigManager } from '@/utils/config.js';
import { logger } from '@/utils/logger.js';

export const configCommand = new Command('config')
  .description('Manage Kumiki configuration')
  .addCommand(
    new Command('set')
      .description('Set a configuration value')
      .argument('<key>', 'Configuration key (e.g., gemini.apiKey)')
      .argument('<value>', 'Configuration value')
      .action(async (key: string, value: string) => {
        try {
          await ConfigManager.set(key, value);
          
          // Mask sensitive values for display
          const displayValue = key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')
            ? value.substring(0, 4) + '****' + value.substring(value.length - 4)
            : value;
          
          logger.info('Configuration updated', { key, value: displayValue });
          console.log(`✓ Set ${key} = ${displayValue}`);
        } catch (error) {
          logger.error('Failed to set configuration', { error });
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('get')
      .description('Get a configuration value')
      .argument('<key>', 'Configuration key (e.g., gemini.apiKey)')
      .action(async (key: string) => {
        try {
          const value = await ConfigManager.get(key);
          
          if (value === undefined) {
            console.log(`Configuration key '${key}' is not set`);
            process.exit(1);
          }
          
          // Mask sensitive values for display
          const displayValue = key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')
            ? value.substring(0, 4) + '****' + value.substring(value.length - 4)
            : value;
          
          console.log(displayValue);
        } catch (error) {
          logger.error('Failed to get configuration', { error });
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('unset')
      .description('Remove a configuration value')
      .argument('<key>', 'Configuration key (e.g., gemini.apiKey)')
      .action(async (key: string) => {
        try {
          await ConfigManager.unset(key);
          logger.info('Configuration removed', { key });
          console.log(`✓ Removed ${key}`);
        } catch (error) {
          logger.error('Failed to unset configuration', { error });
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all configuration values')
      .action(async () => {
        try {
          const config = await ConfigManager.list();
          
          if (Object.keys(config).length === 0) {
            console.log('No configuration values set');
            return;
          }
          
          // Recursively display config with masked sensitive values
          const maskSensitive = (obj: unknown, path = ''): unknown => {
            if (!obj || typeof obj !== 'object') return obj;
            
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
              const fullPath = path ? `${path}.${key}` : key;
              if (typeof value === 'object' && value !== null) {
                result[key] = maskSensitive(value, fullPath);
              } else if (typeof value === 'string' && (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret'))) {
                result[key] = value.substring(0, 4) + '****' + value.substring(value.length - 4);
              } else {
                result[key] = value;
              }
            }
            return result;
          };
          
          const maskedConfig = maskSensitive(config);
          console.log(JSON.stringify(maskedConfig, null, 2));
        } catch (error) {
          logger.error('Failed to list configuration', { error });
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('path')
      .description('Show the configuration file path')
      .action(() => {
        console.log(ConfigManager.getConfigPath());
      })
  );