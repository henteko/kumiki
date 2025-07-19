import { existsSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { projectSchema } from '@/core/schema.js';
import type { KumikiProject, ValidationResult, ValidationError as ValidationErrorType } from '@/types/index.js';
import { logger } from '@/utils/logger.js';


export function validateProject(data: unknown): ValidationResult {
  logger.info('Validating project structure');

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
      
      return {
        valid: false,
        errors,
      };
    }
    
    throw error;
  }
}

function validateAdditionalRules(project: KumikiProject): ValidationErrorType[] {
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
    if (scene.type === 'image') {
      const filePath = path.resolve(projectDir, scene.content.src);
      if (!existsSync(filePath)) {
        errors.push({
          path: `scenes[${index}].content.src`,
          message: `File not found: ${scene.content.src}`,
          code: 'FILE_NOT_FOUND',
        });
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
    const filePath = path.resolve(projectDir, project.audio.backgroundMusic.src);
    if (!existsSync(filePath)) {
      errors.push({
        path: 'audio.backgroundMusic.src',
        message: `Audio file not found: ${project.audio.backgroundMusic.src}`,
        code: 'FILE_NOT_FOUND',
      });
    }
  }
  
  if (project.audio?.soundEffects) {
    project.audio.soundEffects.forEach((effect, index) => {
      const filePath = path.resolve(projectDir, effect.src);
      if (!existsSync(filePath)) {
        errors.push({
          path: `audio.soundEffects[${index}].src`,
          message: `Sound effect file not found: ${effect.src}`,
          code: 'FILE_NOT_FOUND',
        });
      }
    });
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