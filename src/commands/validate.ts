import { Command } from 'commander';

import { parseProjectFile } from '@/core/parser.js';
import { validateProject } from '@/core/validator.js';
import { logger } from '@/utils/logger.js';

export const validateCommand = new Command('validate')
  .description('Validate a Kumiki project file')
  .argument('<file>', 'path to the project JSON file')
  .option('-v, --verbose', 'enable verbose output')
  .action(async (file: string, options: { verbose?: boolean }) => {
    if (options.verbose) {
      logger.level = 'debug';
    }

    try {
      logger.info('Starting validation', { file });

      // Parse JSON file
      const projectData = await parseProjectFile(file);

      // Validate project structure
      const result = validateProject(projectData);

      if (result.valid) {
        logger.info('✅ Validation successful!');
        process.exit(0);
      } else {
        logger.error('❌ Validation failed!');
        
        result.errors.forEach((error) => {
          logger.error(`  - ${error.path}: ${error.message}`);
        });
        
        process.exit(1);
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error: ${error.message}`);
        if (options.verbose && error.stack) {
          logger.debug(error.stack);
        }
      } else {
        logger.error('An unknown error occurred');
      }
      process.exit(1);
    }
  });