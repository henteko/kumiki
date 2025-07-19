import { readFile } from 'node:fs/promises';

import type { KumikiProject } from '@/types/index.js';
import { ParseError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';


export async function parseProjectFile(filePath: string): Promise<KumikiProject> {
  logger.info('Parsing project file', { filePath });

  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as KumikiProject;
    
    logger.debug('Successfully parsed JSON', { 
      version: data.version,
      name: data.name,
      sceneCount: data.scenes?.length || 0,
    });
    
    return data;
  } catch (error) {
    if (error instanceof Error) {
      if ('code' in error && error.code === 'ENOENT') {
        throw new ParseError(
          `Project file not found: ${filePath}`,
          'FILE_NOT_FOUND',
          { filePath },
        );
      }
      
      if (error instanceof SyntaxError) {
        throw new ParseError(
          `Invalid JSON in project file: ${error.message}`,
          'INVALID_JSON',
          { filePath, originalError: error.message },
        );
      }
    }
    
    throw new ParseError(
      'Failed to parse project file',
      'PARSE_ERROR',
      { filePath, error },
    );
  }
}