import { existsSync } from 'node:fs';
import path from 'node:path';

import { BaseScene } from '@/scenes/base.js';
import { FFmpegService } from '@/services/ffmpeg.js';
import type { VideoScene } from '@/types/index.js';
import { RenderError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';


export class VideoSceneRenderer extends BaseScene<VideoScene> {
  /**
   * Validate video scene configuration
   */
  validate(): boolean {
    if (!this.scene.content.src) {
      throw new RenderError(
        'Video source is required',
        'MISSING_VIDEO_SOURCE',
        { sceneId: this.scene.id },
      );
    }

    // Check if video file exists
    const videoPath = path.resolve(process.cwd(), this.scene.content.src);
    if (!existsSync(videoPath)) {
      throw new RenderError(
        `Video file not found: ${this.scene.content.src}`,
        'VIDEO_NOT_FOUND',
        { sceneId: this.scene.id, src: this.scene.content.src },
      );
    }

    // Validate trim settings if present
    if (this.scene.content.trim) {
      const { start, end } = this.scene.content.trim;
      if (start >= end) {
        throw new RenderError(
          'Trim start time must be less than end time',
          'INVALID_TRIM',
          { sceneId: this.scene.id, start, end },
        );
      }
    }

    return true;
  }

  /**
   * Render video scene to static image (first frame)
   */
  async renderStatic(): Promise<string> {
    this.validate();
    await this.ensureOutputDirectory();

    logger.info('Extracting first frame from video', {
      sceneId: this.scene.id,
      src: this.scene.content.src,
    });

    // For static preview, extract first frame
    const outputPath = this.getStaticOutputPath();
    const videoPath = path.resolve(process.cwd(), this.scene.content.src);
    
    const ffmpeg = FFmpegService.getInstance();
    
    // Extract frame at start time (or 0 if no trim)
    const startTime = this.scene.content.trim?.start || 0;
    
    await ffmpeg.execute('ffmpeg', [
      '-ss', startTime.toString(),
      '-i', videoPath,
      '-vframes', '1',
      '-y',
      outputPath,
    ]);

    logger.info('First frame extracted', {
      sceneId: this.scene.id,
      outputPath,
    });

    return outputPath;
  }

  /**
   * Render video scene to video
   */
  async renderVideo(): Promise<string> {
    this.validate();
    await this.ensureOutputDirectory();

    logger.info('Processing video scene', {
      sceneId: this.scene.id,
      duration: this.scene.duration,
      hasNarration: !!this.narrationPath,
    });

    const videoPath = path.resolve(process.cwd(), this.scene.content.src);
    let outputPath = this.getVideoOutputPath();
    const ffmpeg = FFmpegService.getInstance();

    if (this.scene.content.trim) {
      // Trim video
      const duration = this.scene.content.trim.end - this.scene.content.trim.start;
      
      await ffmpeg.trimVideo({
        input: videoPath,
        output: outputPath,
        start: this.scene.content.trim.start,
        duration: Math.min(duration, this.scene.duration),
        resolution: this.options.resolution,
      });
    } else {
      // Use full video but limit to scene duration
      await ffmpeg.trimVideo({
        input: videoPath,
        output: outputPath,
        start: 0,
        duration: this.scene.duration,
        resolution: this.options.resolution,
      });
    }

    // Add narration if available
    if (this.narrationPath && this.scene.narration) {
      const narrationVideoPath = outputPath.replace('.mp4', '_narrated.mp4');
      
      await ffmpeg.addNarrationTrack(
        outputPath,
        this.narrationPath,
        narrationVideoPath,
        {
          narrationVolume: this.scene.narration.voice?.volumeGainDb 
            ? Math.pow(10, this.scene.narration.voice.volumeGainDb / 20)
            : 0.8,
          bgmVolume: 0.3, // Lower existing video audio
          delay: this.scene.narration.timing?.delay || 0,
          fadeIn: this.scene.narration.timing?.fadeIn || 0,
          fadeOut: this.scene.narration.timing?.fadeOut || 0,
        }
      );
      
      outputPath = narrationVideoPath;
    }

    logger.info('Video scene processed', {
      sceneId: this.scene.id,
      outputPath,
      hasNarration: !!this.narrationPath,
    });

    return outputPath;
  }
}