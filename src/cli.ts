#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { program } from 'commander';

import { generateCommand } from '@/commands/generate.js';
import { previewCommand } from '@/commands/preview.js';
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

program.addCommand(validateCommand);
program.addCommand(previewCommand);
program.addCommand(generateCommand);

program.parse();

// Handle uncaught errors
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});