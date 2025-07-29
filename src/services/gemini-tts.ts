import fs from 'node:fs/promises';
import path from 'node:path';

import { GoogleGenAI } from '@google/genai';

import { Voice, NarrationTiming } from '@/types/index.js';
import { ConfigManager } from '@/utils/config.js';
import { KumikiError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

export class GeminiTTSError extends KumikiError {
  constructor(message: string, details?: unknown) {
    super(message, 'GEMINI_TTS_ERROR', details);
  }
}

export interface GenerateSpeechParams {
  text: string;
  voice?: Voice;
  outputPath: string;
}

export interface GenerateSpeechResult {
  audioPath: string;
  duration: number;
}

export class GeminiTTSService {
  private genAI: GoogleGenAI | null = null;
  private initialized = false;

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Try to get API key from config first, then environment variable
    const apiKey = await ConfigManager.get('gemini.apiKey') || process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({
        apiKey: apiKey,
      });
    }
    this.initialized = true;
  }

  async generateSpeech(params: GenerateSpeechParams): Promise<GenerateSpeechResult> {
    await this.initialize();
    
    if (!this.genAI) {
      throw new GeminiTTSError('Gemini API key is not configured. Set it using: kumiki config set gemini.apiKey <YOUR_API_KEY> or set GEMINI_API_KEY environment variable');
    }

    const { text, voice, outputPath } = params;
    
    logger.info('Generating speech with Gemini TTS', {
      text: text.substring(0, 50) + '...',
      voice,
      outputPath,
    });

    try {
      // Prepare voice configuration
      const voiceConfig = this.prepareVoiceConfig(voice);
      
      // Use Gemini 2.5 Flash TTS model
      const model = 'gemini-2.5-flash-preview-tts';
      
      logger.debug('Using Gemini TTS model', { model, voiceConfig });

      // Generate speech
      // TODO: Update when official TypeScript types are available for TTS
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      const response = await this.genAI.models.generateContent({
        model,
        contents: text,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig,
          },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Extract audio data from response
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const audioData = this.extractAudioData(response);
      
      // Convert PCM to WAV format
      const wavData = this.convertPCMtoWAV(audioData);
      
      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Write audio file
      await fs.writeFile(outputPath, wavData);
      
      logger.info('Speech generation completed', { outputPath });
      
      // Calculate duration (placeholder - will need actual duration calculation)
      const duration = this.calculateAudioDuration(wavData);
      
      return {
        audioPath: outputPath,
        duration,
      };
    } catch (error) {
      if (error instanceof GeminiTTSError) {
        throw error;
      }
      
      logger.error('Failed to generate speech', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        params: { text: text.substring(0, 50) + '...', voice, outputPath },
      });
      
      throw new GeminiTTSError(
        error instanceof Error ? error.message : 'Failed to generate speech', 
        error
      );
    }
  }

  private prepareVoiceConfig(voice?: Voice): Record<string, unknown> {
    const defaultVoice: Voice = {
      languageCode: 'ja-JP',
      name: 'Kore',
      speakingRate: 1.0,
      pitch: 0,
      volumeGainDb: 0,
    };

    const finalVoice = { ...defaultVoice, ...voice };
    
    return {
      name: finalVoice.name,
      languageCode: finalVoice.languageCode,
      speakingRate: finalVoice.speakingRate,
      pitch: finalVoice.pitch,
      volumeGainDb: finalVoice.volumeGainDb,
    };
  }

  private extractAudioData(response: { 
    candidates?: Array<{ 
      content?: { 
        parts?: Array<{ 
          inlineData?: { 
            mimeType?: string; 
            data?: string 
          } 
        }> 
      } 
    }> 
  }): Buffer {
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No candidates in TTS response');
    }

    const candidate = response.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts) {
      throw new Error('No content parts in TTS response');
    }

    // Find audio data in response
    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.mimeType === 'audio/L16;codec=pcm;rate=24000' && part.inlineData.data) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }

    throw new Error('No audio data found in TTS response');
  }

  private convertPCMtoWAV(pcmData: Buffer): Buffer {
    // WAV header for 16-bit PCM, 24kHz, mono
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const channels = 1;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return Buffer.concat([header, pcmData]);
  }

  private calculateAudioDuration(wavData: Buffer): number {
    // Skip WAV header (44 bytes)
    const dataSize = wavData.length - 44;
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const channels = 1;
    
    const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
    return dataSize / bytesPerSecond;
  }

  /**
   * Apply timing effects to audio (delay, fade in/out)
   * This will be implemented later with FFmpeg integration
   */
  async applyTimingEffects(
    audioPath: string,
    _timing: NarrationTiming,
    outputPath: string
  ): Promise<void> {
    // TODO: Implement with FFmpeg
    // For now, just copy the file
    if (audioPath !== outputPath) {
      await fs.copyFile(audioPath, outputPath);
    }
  }
}

// Singleton instance
export const geminiTTSService = new GeminiTTSService();