import fs from 'node:fs/promises';
import path from 'node:path';

import { Command } from 'commander';

import { logger } from '@/utils/logger.js';

const initialTemplate = {
  version: "1.0.0",
  name: "My Awesome Video",
  settings: {
    resolution: "1920x1080",
    fps: 30,
    narrationDefaults: {
      voice: {
        languageCode: "en-US",
        name: "Journey",
        speakingRate: 1.0
      },
      volumeMix: {
        narration: 0.8,
        bgm: 0.3
      }
    }
  },
  audio: {
    backgroundMusic: {
      src: "generate://ambient piano music for presentation",
      volume: 0.7,
      fadeIn: 2,
      fadeOut: 3
    }
  },
  scenes: [
    {
      id: "intro",
      type: "text",
      duration: 5,
      content: {
        text: "Hello, Kumiki!",
        style: {
          fontSize: 64,
          color: "#FFFFFF",
          fontFamily: "Arial",
          fontWeight: "bold",
          textAlign: "center"
        },
        position: {
          x: "center",
          y: "center"
        }
      },
      background: {
        type: "gradient",
        value: "linear-gradient(45deg, #FC466B 0%, #3F5EFB 100%)"
      },
      narration: {
        text: "Hello, Kumiki!"
      }
    },
    {
      id: "generate-image",
      type: "image",
      duration: 10,
      content: {
        src: "generate://A beautiful sunset over the ocean with orange and pink sky",
        fit: "cover",
        position: { x: "center", y: "center" }
      },
      narration: {
        text: "This is a beautiful sunset over the ocean with orange and pink sky generated by Gemini."
      }
    }
  ]
};

export const initCommand = new Command('init')
  .description('Initialize a new Kumiki project with a sample configuration')
  .argument('[filename]', 'Output filename', 'project.json')
  .option('-f, --force', 'Overwrite existing file')
  .action(async (filename: string, options: { force?: boolean }) => {
    try {
      const outputPath = path.resolve(filename);
      
      // Check if file already exists
      try {
        await fs.access(outputPath);
        if (!options.force) {
          logger.error('File already exists', { 
            filename: outputPath,
            message: 'Use --force to overwrite'
          });
          process.exit(1);
        }
      } catch {
        // File doesn't exist, which is good
      }

      // Write the template to file
      await fs.writeFile(
        outputPath, 
        JSON.stringify(initialTemplate, null, 2),
        'utf-8'
      );

      logger.info('Initialized new Kumiki project', { filename: outputPath });
      console.log(`\nCreated ${outputPath}\n`);
      console.log('Next steps:');
      console.log('1. Edit the project file to customize your video');
      console.log('2. Run: kumiki validate ' + filename);
      console.log('3. Run: kumiki generate ' + filename);
      
    } catch (error) {
      logger.error('Failed to initialize project', { error });
      process.exit(1);
    }
  });