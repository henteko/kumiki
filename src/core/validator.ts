import { existsSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { projectSchema } from '@/core/schema.js';
import type { KumikiProject, ValidationResult, ValidationError as ValidationErrorType } from '@/types/index.js';
import { logger } from '@/utils/logger.js';


export function validateProject(data: unknown): ValidationResult {
  logger.info('Validating project structure');
  logger.debug('Project data:', { data });

  try {
    const project = projectSchema.parse(data) as KumikiProject;
    
    // Additional validations
    const additionalErrors = validateAdditionalRules(project);
    
    if (additionalErrors.length > 0) {
      return {
        valid: false,
        errors: additionalErrors,
      };
    }
    
    logger.info('Project validation successful', {
      sceneCount: project.scenes.length,
      totalDuration: calculateTotalDuration(project),
    });
    
    return {
      valid: true,
      errors: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
        code: 'VALIDATION_ERROR',
      }));
      
      logger.error('Validation failed', { errorCount: errors.length });
      errors.forEach(err => {
        logger.error(`Validation error at ${err.path}: ${err.message}`);
      });
      
      // Add more debug info
      logger.debug('Zod error details:', { 
        issues: error.issues,
        formattedError: error.format()
      });
      
      return {
        valid: false,
        errors,
      };
    }
    
    throw error;
  }
}

function validateAdditionalRules(project: KumikiProject): ValidationErrorType[] {
  logger.debug('Starting additional validations');
  const errors: ValidationErrorType[] = [];
  const projectDir = process.cwd();
  
  // Check scene IDs are unique
  const sceneIds = new Set<string>();
  project.scenes.forEach((scene, index) => {
    if (sceneIds.has(scene.id)) {
      errors.push({
        path: `scenes[${index}].id`,
        message: `Duplicate scene ID: ${scene.id}`,
        code: 'DUPLICATE_ID',
      });
    }
    sceneIds.add(scene.id);
  });
  
  // Validate file references
  project.scenes.forEach((scene, index) => {
    logger.debug(`Validating scene ${index}`, { type: scene.type });
    if (scene.type === 'image') {
      // Skip validation for generate URLs
      const src = scene.content.src;
      logger.debug(`Checking image src`, { src, typeOfSrc: typeof src });
      // Check for generate URLs
      if (typeof src === 'object' || (typeof src === 'string' && src.startsWith('generate://'))) {
        logger.debug('Skipping validation for generate URL');
        return; // Skip to next iteration
      }
      if (typeof src === 'string') {
        const filePath = path.resolve(projectDir, src);
        if (!existsSync(filePath)) {
          errors.push({
            path: `scenes[${index}].content.src`,
            message: `File not found: ${src}`,
            code: 'FILE_NOT_FOUND',
          });
        }
      }
    } else if (scene.type === 'video') {
      const filePath = path.resolve(projectDir, scene.content.src);
      if (!existsSync(filePath)) {
        errors.push({
          path: `scenes[${index}].content.src`,
          message: `File not found: ${scene.content.src}`,
          code: 'FILE_NOT_FOUND',
        });
      }
    }
    
    if (scene.background?.type === 'image') {
      const filePath = path.resolve(projectDir, scene.background.value);
      if (!existsSync(filePath)) {
        errors.push({
          path: `scenes[${index}].background.value`,
          message: `Background image not found: ${scene.background.value}`,
          code: 'FILE_NOT_FOUND',
        });
      }
    }
  });
  
  // Validate audio files
  if (project.audio?.backgroundMusic) {
    // Skip validation for generate URLs
    const src = project.audio.backgroundMusic.src;
    if (typeof src === 'object' || (typeof src === 'string' && src.startsWith('generate://'))) {
      logger.debug('Skipping validation for generate music URL');
    } else if (typeof src === 'string') {
      const filePath = path.resolve(projectDir, src);
      if (!existsSync(filePath)) {
        errors.push({
          path: 'audio.backgroundMusic.src',
          message: `Audio file not found: ${src}`,
          code: 'FILE_NOT_FOUND',
        });
      }
    }
  }
  
  
  // Validate video trim times
  project.scenes.forEach((scene, index) => {
    if (scene.type === 'video' && scene.content.trim) {
      if (scene.content.trim.start >= scene.content.trim.end) {
        errors.push({
          path: `scenes[${index}].content.trim`,
          message: 'Trim start time must be less than end time',
          code: 'INVALID_TRIM',
        });
      }
    }
  });
  
  return errors;
}

function calculateTotalDuration(project: KumikiProject): number {
  return project.scenes.reduce((total, scene) => total + scene.duration, 0);
}