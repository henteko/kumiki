import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import PQueue from 'p-queue';

import { parseProjectFile } from '@/core/parser.js';
import { SceneFactory } from '@/scenes/factory.js';
import { FFmpegService } from '@/services/ffmpeg.js';
import type { KumikiProject } from '@/types/index.js';
import { ProcessError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';


export interface RenderOptions {
  outputPath: string;
  tempDir?: string;
  concurrency?: number;
  keepTemp?: boolean;
  onProgress?: (progress: number) => void;
}

export class Renderer {
  private project!: KumikiProject; // Will be initialized in render()
  private options: RenderOptions;
  private tempDir: string;
  private ffmpeg: FFmpegService;

  constructor(private projectPath: string, options: RenderOptions) {
    this.options = options;
    this.tempDir = options.tempDir || path.join(path.dirname(options.outputPath), '.kumiki-temp');
    this.ffmpeg = FFmpegService.getInstance();
  }

  /**
   * Render the complete video
   */
  async render(): Promise<void> {
    // Load project
    this.project = await parseProjectFile(this.projectPath);
    
    logger.info('Starting video generation', {
      scenes: this.project.scenes.length,
      output: this.options.outputPath,
    });

    try {
      // Check FFmpeg installation
      const ffmpegInstalled = await this.ffmpeg.checkInstallation();
      if (!ffmpegInstalled) {
        throw new ProcessError(
          'FFmpeg is not installed or not in PATH',
          'FFMPEG_NOT_FOUND',
        );
      }

      // Create temp directory
      await this.ensureTempDirectory();

      // Parse resolution and fps
      const [width, height] = this.project.settings.resolution.split('x').map(Number);
      if (!width || !height) {
        throw new ProcessError(
          `Invalid resolution format: ${this.project.settings.resolution}`,
          'INVALID_RESOLUTION',
        );
      }
      const fps = this.project.settings.fps;

      // Render all scenes to videos
      const scenePaths = await this.renderScenes({ width, height, fps });

      // Concatenate all scene videos
      await this.concatenateScenes(scenePaths);

      // Add audio if specified
      if (this.project.audio?.backgroundMusic) {
        await this.addBackgroundMusic();
      }

      logger.info('Video generation completed', {
        output: this.options.outputPath,
      });
    } finally {
      // Cleanup temp directory if not keeping
      if (!this.options.keepTemp) {
        await this.cleanupTempDirectory();
      }
    }
  }

  /**
   * Render all scenes to individual videos
   */
  private async renderScenes(settings: {
    width: number;
    height: number;
    fps: number;
  }): Promise<string[]> {
    const queue = new PQueue({ concurrency: this.options.concurrency || 2 });
    const scenePaths: string[] = [];

    logger.info('Rendering scenes', { count: this.project.scenes.length });

    const renderPromises = this.project.scenes.map((scene, index) =>
      queue.add(async () => {
        logger.info(`Rendering scene ${index + 1}/${this.project.scenes.length}`, {
          sceneId: scene.id,
          type: scene.type,
        });

        const renderer = SceneFactory.create(scene, {
          resolution: this.project.settings.resolution,
          fps: settings.fps,
          tempDir: this.tempDir,
        });

        const videoPath = await renderer.renderVideo();
        scenePaths[index] = videoPath;

        // Update progress
        if (this.options.onProgress) {
          const progress = ((index + 1) / this.project.scenes.length) * 80; // 80% for scene rendering
          this.options.onProgress(progress);
        }

        logger.info(`Scene rendered`, {
          sceneId: scene.id,
          path: videoPath,
        });
      }),
    );

    await Promise.all(renderPromises);
    return scenePaths;
  }

  /**
   * Concatenate all scene videos into final output
   */
  private async concatenateScenes(scenePaths: string[]): Promise<void> {
    logger.info('Concatenating scenes', { count: scenePaths.length });

    const tempOutput = path.join(this.tempDir, 'combined.mp4');
    
    await this.ffmpeg.concatenate({
      inputs: scenePaths,
      output: tempOutput,
      onProgress: (progress) => {
        if (this.options.onProgress) {
          // Concatenation is 80-95% of total progress
          this.options.onProgress(80 + (progress * 0.15));
        }
      },
    });

    // If no audio, this is our final output
    if (!this.project.audio?.backgroundMusic) {
      await this.moveToFinalOutput(tempOutput);
    }
  }

  /**
   * Add background music to the video
   */
  private async addBackgroundMusic(): Promise<void> {
    const musicPath = path.resolve(process.cwd(), this.project.audio!.backgroundMusic!.src);
    const tempVideo = path.join(this.tempDir, 'combined.mp4');
    
    logger.info('Adding background music', {
      music: musicPath,
      volume: this.project.audio!.backgroundMusic!.volume,
    });

    await this.ffmpeg.addAudio(
      tempVideo,
      musicPath,
      this.options.outputPath,
      this.project.audio!.backgroundMusic!.volume,
    );

    if (this.options.onProgress) {
      this.options.onProgress(100);
    }
  }

  /**
   * Move temp file to final output
   */
  private async moveToFinalOutput(tempPath: string): Promise<void> {
    const { rename } = await import('node:fs/promises');
    
    // Ensure output directory exists
    const outputDir = path.dirname(this.options.outputPath);
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    await rename(tempPath, this.options.outputPath);
    
    if (this.options.onProgress) {
      this.options.onProgress(100);
    }
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDirectory(): Promise<void> {
    if (!existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Cleanup temp directory
   */
  private async cleanupTempDirectory(): Promise<void> {
    if (existsSync(this.tempDir)) {
      logger.debug('Cleaning up temp directory', { path: this.tempDir });
      await rm(this.tempDir, { recursive: true, force: true });
    }
  }
}