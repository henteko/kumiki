import type { Animation } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

export interface AnimationFilter {
  filter: string;
  startTime: number;
  endTime: number;
}

export class AnimationService {
  /**
   * Generate FFmpeg filter for animation
   */
  static generateFilter(
    animation: Animation,
    sceneDuration: number,
    resolution: string,
  ): AnimationFilter | null {
    const [width, height] = resolution.split('x').map(Number);
    
    if (!width || !height) {
      logger.error('Invalid resolution format', { resolution });
      return null;
    }
    
    switch (animation.type) {
      case 'fade-in':
        return this.generateFadeInFilter(animation, sceneDuration);
      case 'fade-out':
        return this.generateFadeOutFilter(animation, sceneDuration);
      default:
        logger.warn('Unknown animation type', { type: animation.type });
        return null;
    }
  }

  /**
   * Generate fade-in filter
   */
  private static generateFadeInFilter(
    animation: Animation,
    sceneDuration: number,
  ): AnimationFilter {
    const startTime = 0;
    const duration = Math.min(animation.duration, sceneDuration);
    
    logger.debug('Generating fade-in filter', { duration, sceneDuration });
    
    return {
      filter: `fade=t=in:st=${startTime}:d=${duration}`,
      startTime,
      endTime: startTime + duration,
    };
  }

  /**
   * Generate fade-out filter
   */
  private static generateFadeOutFilter(
    animation: Animation,
    sceneDuration: number,
  ): AnimationFilter {
    const duration = Math.min(animation.duration, sceneDuration);
    const startTime = Math.max(0, sceneDuration - duration);
    
    logger.debug('Generating fade-out filter', { duration, startTime, sceneDuration });
    
    return {
      filter: `fade=t=out:st=${startTime}:d=${duration}`,
      startTime,
      endTime: sceneDuration,
    };
  }



  /**
   * Combine multiple filters
   */
  static combineFilters(filters: AnimationFilter[]): string {
    const validFilters = filters
      .filter(f => f.filter)
      .map(f => f.filter);
    
    if (validFilters.length === 0) {
      return '';
    }
    
    return validFilters.join(',');
  }

  /**
   * Apply easing function to animation
   * For now, we'll use linear timing as FFmpeg doesn't directly support easing
   */
  static applyEasing(
    _animation: Animation,
    currentTime: number,
    duration: number,
  ): number {
    const progress = Math.min(1, Math.max(0, currentTime / duration));
    
    // TODO: Implement proper easing functions
    // For now, return linear progress
    return progress;
  }
}