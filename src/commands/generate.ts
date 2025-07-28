import { existsSync } from 'node:fs';
import path from 'node:path';

import { Command } from 'commander';
import * as React from 'react';

import { parseProjectFile } from '@/core/parser.js';
import { Renderer } from '@/core/renderer.js';
import { validateProject } from '@/core/validator.js';
import { SubtitleGenerator } from '@/generators/subtitle/index.js';
import { registerSceneRenderers } from '@/scenes/index.js';
import { PuppeteerService } from '@/services/puppeteer.js';
import { GenerateProgress, ValidationResult } from '@/ui/components.js';
import { logger } from '@/utils/logger.js';


export const generateCommand = new Command('generate')
  .description('Generate a video from JSON configuration')
  .argument('<file>', 'Path to the JSON configuration file')
  .option('-o, --output <path>', 'Output video file path', './output.mp4')
  .option('-t, --temp <dir>', 'Temporary directory for intermediate files')
  .option('--keep-temp', 'Keep temporary files after generation')
  .option('-c, --concurrency <number>', 'Number of scenes to process in parallel', '2')
  .option('--no-subtitles', 'Skip subtitle generation')
  .action(async (file: string, options: {
    output: string;
    temp?: string;
    keepTemp?: boolean;
    concurrency: string;
    subtitles: boolean;
  }) => {
    try {
      logger.info('Starting video generation', { file, output: options.output });

      // Validate file exists
      if (!existsSync(file)) {
        logger.error('Configuration file not found', { file });
        process.exit(1);
      }

      // Register scene renderers
      registerSceneRenderers();

      // Validate project configuration
      const data = await parseProjectFile(file);
      const validationResult = validateProject(data);

      if (!validationResult.valid) {
        logger.renderComponent(
          React.createElement(ValidationResult, { valid: false, errors: validationResult.errors })
        );
        process.exit(1);
      }

      // Create renderer
      const renderer = new Renderer(file, {
        outputPath: options.output,
        tempDir: options.temp,
        keepTemp: options.keepTemp,
        concurrency: parseInt(options.concurrency, 10),
        onProgress: (progress: number): void => {
          logger.renderComponent(
            React.createElement(GenerateProgress, { progress, phase: "rendering" })
          );
        },
      });

      // Render video
      await renderer.render();
      
      // Generate subtitles if not disabled
      if (options.subtitles) {
        try {
          const subtitlePath = options.output.replace(/\.[^.]+$/, '.vtt');
          const subtitleGenerator = new SubtitleGenerator();
          await subtitleGenerator.generateAndSave(data, subtitlePath);
          logger.info('Subtitles generated', { path: subtitlePath });
        } catch (error) {
          logger.error('Failed to generate subtitles', { error });
        }
      }
      
      // Show completion
      logger.clear();
      logger.success('Video generation completed!', {
        output: path.resolve(options.output),
        subtitles: options.subtitles ? path.resolve(options.output.replace(/\.[^.]+$/, '.vtt')) : undefined,
      });
      
      // Cleanup Puppeteer
      await PuppeteerService.cleanup();
      
      // Force exit to ensure all processes are terminated
      process.exit(0);

    } catch (error) {
      logger.error('Failed to generate video', { error });
      // Cleanup Puppeteer on error too
      await PuppeteerService.cleanup();
      process.exit(1);
    }
  });