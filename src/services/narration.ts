import fs from 'node:fs/promises';
import path from 'node:path';

import { geminiTTSService } from './gemini-tts.js';
import { narrationCacheService } from './narration-cache.js';

import { Scene, ProjectSettings, Narration, Voice, NarrationDefaults } from '@/types/index.js';
import { KumikiError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

export class NarrationError extends KumikiError {
  constructor(message: string, details?: unknown) {
    super(message, 'NARRATION_ERROR', details);
  }
}

export interface ProcessNarrationParams {
  scene: Scene;
  narrationDefaults?: NarrationDefaults;
  outputDir: string;
}

export interface ProcessNarrationResult {
  audioPath: string | null;
  duration: number;
}

export class NarrationService {
  /**
   * Process narration for a single scene
   */
  async processSceneNarration(params: ProcessNarrationParams): Promise<ProcessNarrationResult> {
    const { scene, narrationDefaults, outputDir } = params;
    
    // Check if scene has narration
    if (!scene.narration) {
      return { audioPath: null, duration: 0 };
    }
    
    const narration = scene.narration;
    
    logger.info('Processing narration for scene', { 
      sceneId: scene.id,
      text: narration.text.substring(0, 50) + '...' 
    });
    
    try {
      // Merge voice settings with defaults
      const voice = this.mergeVoiceSettings(narration.voice, narrationDefaults?.voice);
      
      // Check cache first
      const cacheKey = { text: narration.text, voice };
      const cachedPath = await narrationCacheService.get(cacheKey);
      
      let audioPath: string;
      let duration: number;
      
      if (cachedPath) {
        // Use cached audio
        audioPath = cachedPath;
        // Get duration from cached file
        duration = await this.getAudioDuration(audioPath);
      } else {
        // Generate new audio
        const tempPath = path.join(outputDir, `narration_${scene.id}_temp.wav`);
        
        const result = await geminiTTSService.generateSpeech({
          text: narration.text,
          voice,
          outputPath: tempPath,
        });
        
        audioPath = result.audioPath;
        duration = result.duration;
        
        // Cache the generated audio
        await narrationCacheService.set(cacheKey, audioPath);
      }
      
      // Apply timing effects if specified
      if (narration.timing) {
        const finalPath = path.join(outputDir, `narration_${scene.id}.wav`);
        await geminiTTSService.applyTimingEffects(audioPath, narration.timing, finalPath);
        audioPath = finalPath;
      }
      
      logger.info('Narration processed successfully', { 
        sceneId: scene.id,
        audioPath,
        duration 
      });
      
      return { audioPath, duration };
    } catch (error) {
      logger.error('Failed to process narration', {
        sceneId: scene.id,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new NarrationError(
        `Failed to process narration for scene ${scene.id}`,
        error
      );
    }
  }
  
  /**
   * Merge voice settings with defaults
   */
  private mergeVoiceSettings(sceneVoice?: Voice, defaultVoice?: Voice): Voice {
    const baseDefaults: Voice = {
      languageCode: 'ja-JP',
      name: 'Kore',
      speakingRate: 1.0,
      pitch: 0,
      volumeGainDb: 0,
    };
    
    return {
      ...baseDefaults,
      ...defaultVoice,
      ...sceneVoice,
    };
  }
  
  /**
   * Get audio duration from WAV file
   * This is a placeholder - actual implementation would read WAV header
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const stats = await fs.stat(audioPath);
      // Estimate based on file size (rough calculation for 24kHz 16-bit mono)
      const bytesPerSecond = 24000 * 2; // 24kHz * 16bit/8
      return stats.size / bytesPerSecond;
    } catch (error) {
      logger.info('Failed to get audio duration, using default', { 
        audioPath, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 5; // Default 5 seconds
    }
  }
  
  /**
   * Extract all narration texts from scenes for pre-processing
   */
  extractNarrationTexts(scenes: Scene[]): Array<{ sceneId: string; narration: Narration }> {
    return scenes
      .filter(scene => scene.narration)
      .map(scene => ({
        sceneId: scene.id,
        narration: scene.narration!,
      }));
  }
  
  /**
   * Pre-generate all narrations for a project
   * This can be used for batch processing or warming up the cache
   */
  async preGenerateNarrations(
    scenes: Scene[],
    settings: ProjectSettings,
    outputDir: string
  ): Promise<Map<string, ProcessNarrationResult>> {
    const narrations = this.extractNarrationTexts(scenes);
    const results = new Map<string, ProcessNarrationResult>();
    
    logger.info(`Pre-generating ${narrations.length} narrations`);
    
    for (const { sceneId } of narrations) {
      const scene = scenes.find(s => s.id === sceneId)!;
      
      try {
        const result = await this.processSceneNarration({
          scene,
          narrationDefaults: settings.narrationDefaults,
          outputDir,
        });
        
        results.set(sceneId, result);
      } catch (error) {
        logger.error('Failed to pre-generate narration', { 
          sceneId, 
          error: error instanceof Error ? error.message : String(error) 
        });
        // Continue with other narrations
      }
    }
    
    return results;
  }
}

// Singleton instance
export const narrationService = new NarrationService();