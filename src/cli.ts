#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { program } from 'commander';

import { cacheCommand } from '@/commands/cache.js';
import { configCommand } from '@/commands/config.js';
import { generateCommand } from '@/commands/generate.js';
import { initCommand } from '@/commands/init.js';
import { previewCommand } from '@/commands/preview.js';
import { showSchemaCommand } from '@/commands/show-schema.js';
import { subtitleCommand } from '@/commands/subtitle.js';
import { validateCommand } from '@/commands/validate.js';
import { logger } from '@/utils/logger.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string; description: string };

program
  .name('kumiki')
  .description(packageJson.description)
  .version(packageJson.version);

program.addCommand(initCommand);
program.addCommand(validateCommand);
program.addCommand(previewCommand);
program.addCommand(generateCommand);
program.addCommand(subtitleCommand);
program.addCommand(configCommand);
program.addCommand(cacheCommand);
program.addCommand(showSchemaCommand);

program.parse();

// Handle uncaught errors
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason instanceof Error ? { error: reason.message } : { reason });
  process.exit(1);
});