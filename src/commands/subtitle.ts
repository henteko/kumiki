import path from 'node:path';

import { Command } from 'commander';

import { parseProjectFile } from '@/core/parser.js';
import { SubtitleGenerator } from '@/generators/subtitle/index.js';
import { logger } from '@/utils/logger.js';

export const subtitleCommand = new Command('subtitle')
  .description('Generate WebVTT subtitles from a Kumiki project file')
  .argument('<file>', 'path to the project JSON file')
  .option('-o, --output <path>', 'output file path (default: {project-name}.vtt)')
  .option('-v, --verbose', 'enable verbose output')
  .action(async (file: string, options: { output?: string; verbose?: boolean }) => {
    if (options.verbose) {
      logger.level = 'debug';
    }

    try {
      logger.info('Starting subtitle generation', { file });

      const project = await parseProjectFile(file);

      const outputPath = options.output || `${path.basename(file, '.json')}.vtt`;
      const absoluteOutputPath = path.resolve(outputPath);

      const generator = new SubtitleGenerator();
      await generator.generateAndSave(project, absoluteOutputPath);

      logger.success(`Subtitles generated successfully: ${absoluteOutputPath}`);
      process.exit(0);
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