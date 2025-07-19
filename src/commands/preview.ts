import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { Command } from 'commander';

import { parseProjectFile } from '@/core/parser.js';
import { validateProject } from '@/core/validator.js';
import { registerSceneRenderers, SceneFactory } from '@/scenes/index.js';
import { PuppeteerService } from '@/services/puppeteer.js';
import { logger } from '@/utils/logger.js';

export const previewCommand = new Command('preview')
  .description('Generate static preview images for each scene')
  .argument('<file>', 'path to the project JSON file')
  .option('-o, --output <dir>', 'output directory for preview images', './preview')
  .option('-v, --verbose', 'enable verbose output')
  .action(async (file: string, options: { output: string; verbose?: boolean }) => {
    if (options.verbose) {
      logger.level = 'debug';
    }

    try {
      logger.info('Starting preview generation', { file, outputDir: options.output });

      // Register scene renderers
      registerSceneRenderers();

      // Parse and validate project
      const projectData = await parseProjectFile(file);
      const validationResult = validateProject(projectData);

      if (!validationResult.valid) {
        logger.error('Project validation failed');
        validationResult.errors.forEach((error) => {
          logger.error(`  - ${error.path}: ${error.message}`);
        });
        process.exit(1);
      }

      // Create output directory
      const outputDir = path.resolve(process.cwd(), options.output);
      if (!existsSync(outputDir)) {
        await mkdir(outputDir, { recursive: true });
      }

      logger.info(`Generating previews for ${projectData.scenes.length} scenes`);

      // Process each scene
      const results: Array<{ sceneId: string; outputPath: string }> = [];
      
      for (const [index, scene] of projectData.scenes.entries()) {
        logger.info(`Processing scene ${index + 1}/${projectData.scenes.length}`, {
          sceneId: scene.id,
          type: scene.type,
        });

        try {
          // Create scene renderer
          const renderer = SceneFactory.create(scene, {
            tempDir: outputDir,
            resolution: projectData.settings.resolution,
            fps: projectData.settings.fps,
          });

          // Render static preview
          const outputPath = await renderer.renderStatic();
          
          results.push({
            sceneId: scene.id,
            outputPath,
          });

          logger.info(`✅ Scene preview generated`, {
            sceneId: scene.id,
            outputPath,
          });
        } catch (error) {
          logger.error(`❌ Failed to render scene`, {
            sceneId: scene.id,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }

      // Summary
      logger.info('🎉 Preview generation completed!', {
        totalScenes: projectData.scenes.length,
        outputDir,
      });

      // Display results
      console.log('\nGenerated previews:');
      results.forEach(({ sceneId, outputPath }) => {
        console.log(`  - ${sceneId}: ${path.relative(process.cwd(), outputPath)}`);
      });

      // Cleanup Puppeteer
      await PuppeteerService.cleanup();

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

      // Cleanup on error
      await PuppeteerService.cleanup();
      
      process.exit(1);
    }
  });