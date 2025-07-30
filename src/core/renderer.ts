import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import PQueue from 'p-queue';

import { parseProjectFile } from '@/core/parser.js';
import { SceneFactory } from '@/scenes/factory.js';
import { FFmpegService } from '@/services/ffmpeg.js';
import { geminiMusicService } from '@/services/gemini-music.js';
import { musicCache, generateMusicCacheKey } from '@/services/music-cache.js';
import { narrationService } from '@/services/narration.js';
import { TransitionService } from '@/services/transition.js';
import type { KumikiProject, ProcessNarrationResult, GenerateMusicSource } from '@/types/index.js';
import { getTmpDir } from '@/utils/app-dirs.js';
import { ProcessError } from '@/utils/errors.js';
import { isGenerateMusicUrl, parseGenerateMusicUrl } from '@/utils/generate-music-url-parser.js';
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
  private narrationResults: Map<string, ProcessNarrationResult> = new Map();

  constructor(private projectPath: string, options: RenderOptions) {
    this.options = options;
    this.tempDir = options.tempDir || path.join(getTmpDir(), `kumiki-render-${Date.now()}`);
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

      // Process narrations for all scenes
      await this.processNarrations();

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

        // Set narration path if available
        const narrationResult = this.narrationResults.get(scene.id);
        if (narrationResult?.audioPath) {
          renderer.setNarrationPath(narrationResult.audioPath);
        }

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
    
    // Apply transitions if specified
    let processedPaths: string[] = [...scenePaths];
    
    if (scenePaths.length > 1) {
      const transitionService = TransitionService.getInstance();
      
      // Process transitions in reverse order to handle overlapping correctly
      for (let i = scenePaths.length - 2; i >= 0; i--) {
        const currentScene = this.project.scenes[i];
        
        if (currentScene?.transition) {
          const transitionOutput = path.join(
            this.tempDir,
            `transition_${i}_${i + 1}.mp4`
          );
          
          logger.info('Applying transition between scenes', {
            from: currentScene.id,
            to: this.project.scenes[i + 1]?.id,
            type: currentScene.transition.type,
            direction: currentScene.transition.direction,
          });
          
          // Apply transition between current and next scene
          await transitionService.applyTransition({
            transition: currentScene.transition,
            scene1Path: processedPaths[i]!,
            scene2Path: processedPaths[i + 1]!,
            outputPath: transitionOutput,
            resolution: this.project.settings.resolution,
            fps: this.project.settings.fps,
          });
          
          // Replace the two scenes with the transition output
          processedPaths = [
            ...processedPaths.slice(0, i),
            transitionOutput,
            ...processedPaths.slice(i + 2)
          ];
        }
      }
    }
    
    // Concatenate all videos (with transitions applied)
    await this.ffmpeg.concatenate({
      inputs: processedPaths,
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
    const tempVideo = path.join(this.tempDir, 'combined.mp4');
    const bgMusic = this.project.audio!.backgroundMusic!;
    
    // Resolve music path (handle generate:// URLs)
    let musicPath: string;
    if (isGenerateMusicUrl(bgMusic.src)) {
      musicPath = await this.resolveGenerateMusicUrl(bgMusic.src);
    } else {
      musicPath = path.resolve(process.cwd(), bgMusic.src as string);
    }
    
    logger.info('Adding background music', {
      music: musicPath,
      volume: bgMusic.volume,
      fadeIn: bgMusic.fadeIn,
      fadeOut: bgMusic.fadeOut,
    });

    // Check if video already has audio (from narration)
    const hasAudio = await this.ffmpeg.hasAudioStream(tempVideo);
    
    if (hasAudio) {
      // Mix background music with existing narration audio
      const volumeMix = this.project.settings.narrationDefaults?.volumeMix || {
        narration: 0.8,
        bgm: 0.3
      };
      
      await this.ffmpeg.mixBackgroundMusic(
        tempVideo,
        musicPath,
        this.options.outputPath,
        {
          musicVolume: bgMusic.volume || volumeMix.bgm,
          existingAudioVolume: 1.0, // Keep narration at full volume
          fadeIn: bgMusic.fadeIn,
          fadeOut: bgMusic.fadeOut,
        }
      );
    } else {
      // No existing audio, just add background music
      if (bgMusic.fadeIn || bgMusic.fadeOut) {
        await this.ffmpeg.addAudioWithFade(
          tempVideo,
          musicPath,
          this.options.outputPath,
          bgMusic.volume,
          bgMusic.fadeIn,
          bgMusic.fadeOut,
        );
      } else {
        // Use the original method for backward compatibility
        await this.ffmpeg.addAudio(
          tempVideo,
          musicPath,
          this.options.outputPath,
          bgMusic.volume,
        );
      }
    }

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
   * Process narrations for all scenes
   */
  private async processNarrations(): Promise<void> {
    const scenesWithNarration = this.project.scenes.filter(scene => scene.narration);
    
    if (scenesWithNarration.length === 0) {
      logger.info('No narrations to process');
      return;
    }
    
    logger.info('Processing narrations', { count: scenesWithNarration.length });
    
    for (const scene of scenesWithNarration) {
      try {
        const result = await narrationService.processSceneNarration({
          scene,
          narrationDefaults: this.project.settings.narrationDefaults,
          outputDir: this.tempDir,
        });
        
        this.narrationResults.set(scene.id, result);
      } catch (error) {
        logger.error('Failed to process narration', {
          sceneId: scene.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other narrations
      }
    }
  }

  /**
   * Resolve generate:// URL to actual music path
   */
  private async resolveGenerateMusicUrl(src: string | GenerateMusicSource): Promise<string> {
    // Initialize cache if needed
    await musicCache.initialize();
    
    // Parse generate URL
    const params = parseGenerateMusicUrl(src);
    
    // Generate cache key
    const cacheKey = generateMusicCacheKey(params);
    
    // Check cache first
    const cachedPath = await musicCache.get(cacheKey, this.projectPath);
    if (cachedPath) {
      logger.info('Using cached generated music', {
        prompt: params.prompt || 'weighted prompts',
        cachedPath,
      });
      logger.info('To replace: Change src to your actual music file path in the JSON file');
      return cachedPath;
    }
    
    // Calculate duration if not specified
    let videoDuration: number;
    if (params.duration) {
      // If duration is explicitly specified in the generate config
      videoDuration = params.duration;
    } else {
      // Calculate total project duration
      videoDuration = this.project.scenes.reduce((total, scene) => total + scene.duration, 0);
    }
    
    // Add 10 seconds buffer to ensure smooth looping and fades
    const generationDuration = videoDuration + 10;
    params.duration = generationDuration;
    
    // Generate new music
    logger.info('Generating background music', {
      prompt: params.prompt,
      prompts: params.prompts,
      duration: generationDuration,
      videoDuration: videoDuration,
      config: params.config,
    });
    
    try {
      const musicData = await geminiMusicService.generateMusic(params);
      
      // Save to cache
      const musicPath = await musicCache.save(cacheKey, musicData, params, this.projectPath);
      
      logger.info('Generated music saved', {
        prompt: params.prompt || 'weighted prompts',
        path: musicPath,
        generatedDuration: generationDuration,
        videoDuration: videoDuration,
      });
      logger.info('To replace: Change src to your actual music file path in the JSON file');
      
      return musicPath;
    } catch (error) {
      logger.error('Failed to generate music', {
        error: error instanceof Error ? error.message : String(error),
        errorDetails: error,
      });
      throw new ProcessError(
        error instanceof Error ? error.message : 'Failed to generate music',
        'MUSIC_GENERATION_FAILED',
        {
          prompt: params.prompt,
          prompts: params.prompts,
          error: error instanceof Error ? error.message : String(error),
        }
      );
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