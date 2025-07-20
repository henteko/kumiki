import path from 'node:path';

import { FFmpegService } from '@/services/ffmpeg.js';
import type { Transition } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

export interface TransitionOptions {
  transition: Transition;
  scene1Path: string;
  scene2Path: string;
  outputPath: string;
  resolution: string;
  fps: number;
}

export class TransitionService {
  private static instance: TransitionService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): TransitionService {
    if (!TransitionService.instance) {
      TransitionService.instance = new TransitionService();
    }
    return TransitionService.instance;
  }

  /**
   * Apply transition between two scenes
   */
  async applyTransition(options: TransitionOptions): Promise<string> {
    const { transition } = options;

    logger.info('Applying transition', {
      type: transition.type,
      duration: transition.duration,
      scene1: path.basename(options.scene1Path),
      scene2: path.basename(options.scene2Path),
    });

    switch (transition.type) {
      case 'fade':
        return this.applyFadeTransition(options);
      case 'wipe':
        return this.applyWipeTransition(options);
      case 'dissolve':
        return this.applyDissolveTransition(options);
      default:
        logger.warning('Unknown transition type', { type: (transition as { type: string }).type });
        return options.scene2Path; // Fallback to no transition
    }
  }

  /**
   * Apply fade transition
   */
  private async applyFadeTransition(options: TransitionOptions): Promise<string> {
    const { transition, scene1Path, scene2Path, outputPath } = options;
    
    logger.debug('Applying fade transition', {
      duration: transition.duration,
    });

    const ffmpeg = FFmpegService.getInstance();
    await ffmpeg.fadeTransition(scene1Path, scene2Path, outputPath, transition.duration);
    
    return outputPath;
  }

  /**
   * Apply wipe transition
   */
  private async applyWipeTransition(options: TransitionOptions): Promise<string> {
    const { transition, scene1Path, scene2Path, outputPath } = options;
    const direction = transition.direction || 'left';
    
    logger.debug('Applying wipe transition', {
      duration: transition.duration,
      direction,
    });

    const ffmpeg = FFmpegService.getInstance();
    await ffmpeg.wipeTransition(scene1Path, scene2Path, outputPath, transition.duration, direction);
    
    return outputPath;
  }

  /**
   * Apply dissolve transition
   */
  private async applyDissolveTransition(options: TransitionOptions): Promise<string> {
    const { transition, scene1Path, scene2Path, outputPath } = options;
    
    logger.debug('Applying dissolve transition', {
      duration: transition.duration,
    });

    const ffmpeg = FFmpegService.getInstance();
    await ffmpeg.dissolveTransition(scene1Path, scene2Path, outputPath, transition.duration);
    
    return outputPath;
  }
}