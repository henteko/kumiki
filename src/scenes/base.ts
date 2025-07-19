import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { AnimationService } from '@/services/animation.js';
import type { Scene, SceneRenderOptions } from '@/types/index.js';
import { RenderError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';


export abstract class BaseScene<T extends Scene = Scene> {
  protected scene: T;
  protected options: SceneRenderOptions;

  constructor(scene: T, options: SceneRenderOptions) {
    this.scene = scene;
    this.options = options;
  }

  /**
   * Render the scene to a static image (PNG)
   */
  abstract renderStatic(): Promise<string>;

  /**
   * Render the scene to a video (MP4)
   */
  abstract renderVideo(): Promise<string>;

  /**
   * Validate the scene configuration
   */
  abstract validate(): boolean;

  /**
   * Get the output path for static image
   */
  protected getStaticOutputPath(): string {
    return path.join(this.options.tempDir, `scene_${this.scene.id}.png`);
  }

  /**
   * Get the output path for video
   */
  protected getVideoOutputPath(): string {
    return path.join(this.options.tempDir, `scene_${this.scene.id}.mp4`);
  }

  /**
   * Ensure the output directory exists
   */
  protected async ensureOutputDirectory(): Promise<void> {
    if (!existsSync(this.options.tempDir)) {
      logger.debug('Creating output directory', { path: this.options.tempDir });
      await mkdir(this.options.tempDir, { recursive: true });
    }
  }

  /**
   * Parse resolution string to width and height
   */
  protected parseResolution(): { width: number; height: number } {
    const [width, height] = this.options.resolution.split('x').map(Number);
    if (!width || !height) {
      throw new RenderError(
        `Invalid resolution format: ${this.options.resolution}`,
        'INVALID_RESOLUTION',
        { resolution: this.options.resolution },
      );
    }
    return { width, height };
  }

  /**
   * Calculate position coordinates
   */
  protected calculatePosition(
    pos: number | 'center',
    dimension: number,
    elementSize: number,
  ): number {
    if (pos === 'center') {
      return (dimension - elementSize) / 2;
    }
    return pos;
  }

  /**
   * Get animation filter for the scene
   */
  protected getAnimationFilter(): string | undefined {
    if (!this.scene.animation) {
      return undefined;
    }

    const filter = AnimationService.generateFilter(
      this.scene.animation,
      this.scene.duration,
      this.options.resolution,
    );

    if (!filter || !filter.filter) {
      return undefined;
    }

    logger.debug('Animation filter generated', {
      sceneId: this.scene.id,
      type: this.scene.animation.type,
      filter: filter.filter,
    });

    return filter.filter;
  }
}