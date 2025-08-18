#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../src/schemas/generated/typespec-zod/models.ts');

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const fixed = content.replace(/default\(0n\)/g, 'default(0)');
  fs.writeFileSync(filePath, fixed, 'utf8');
  console.log('Fixed generated schema: replaced default(0n) with default(0)');
} catch (error) {
  console.error('Error fixing generated schema:', error.message);
  process.exit(1);
}