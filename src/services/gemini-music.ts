import { GoogleGenAI } from '@google/genai';

import { ConfigManager } from '@/utils/config.js';
import { GeminiError } from '@/utils/errors.js';
import type { GenerateMusicParams } from '@/utils/generate-music-url-parser.js';
import { logger } from '@/utils/logger.js';

// PCMからWAVファイルを作成するヘルパー関数
function pcmToWav(pcmData: Buffer, sampleRate: number = 48000, channels: number = 2): Buffer {
  const bitsPerSample = 16;
  const dataSize = pcmData.length;
  const headerSize = 44;
  const fileSize = dataSize + headerSize - 8;
  
  const buffer = Buffer.alloc(headerSize);
  
  // WAVヘッダーの構築
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
  buffer.writeUInt16LE(channels * bitsPerSample / 8, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  return Buffer.concat([buffer, pcmData]);
}

// Lyriaのスケール定義
enum LyriaScale {
  C_MAJOR_A_MINOR = 0,
  G_MAJOR_E_MINOR = 1,
  D_MAJOR_B_MINOR = 2,
  A_MAJOR_F_SHARP_MINOR = 3,
  E_MAJOR_C_SHARP_MINOR = 4,
  B_MAJOR_G_SHARP_MINOR = 5,
  F_SHARP_MAJOR_D_SHARP_MINOR = 6,
  F_MAJOR_D_MINOR = 7,
  B_FLAT_MAJOR_G_MINOR = 8,
  E_FLAT_MAJOR_C_MINOR = 9,
  A_FLAT_MAJOR_F_MINOR = 10,
  D_FLAT_MAJOR_B_FLAT_MINOR = 11,
  G_FLAT_MAJOR_E_FLAT_MINOR = 12,
  CHROMATIC = 13,
}

// スケール文字列をLyriaScale enumに変換
function getScaleEnum(scale?: string): LyriaScale {
  if (!scale) return LyriaScale.C_MAJOR_A_MINOR;
  
  // LyriaScale enumの値と照合
  const scaleMap: Record<string, LyriaScale> = {
    'C_MAJOR_A_MINOR': LyriaScale.C_MAJOR_A_MINOR,
    'G_MAJOR_E_MINOR': LyriaScale.G_MAJOR_E_MINOR,
    'D_MAJOR_B_MINOR': LyriaScale.D_MAJOR_B_MINOR,
    'A_MAJOR_F_SHARP_MINOR': LyriaScale.A_MAJOR_F_SHARP_MINOR,
    'E_MAJOR_C_SHARP_MINOR': LyriaScale.E_MAJOR_C_SHARP_MINOR,
    'B_MAJOR_G_SHARP_MINOR': LyriaScale.B_MAJOR_G_SHARP_MINOR,
    'F_SHARP_MAJOR_D_SHARP_MINOR': LyriaScale.F_SHARP_MAJOR_D_SHARP_MINOR,
    'F_MAJOR_D_MINOR': LyriaScale.F_MAJOR_D_MINOR,
    'B_FLAT_MAJOR_G_MINOR': LyriaScale.B_FLAT_MAJOR_G_MINOR,
    'E_FLAT_MAJOR_C_MINOR': LyriaScale.E_FLAT_MAJOR_C_MINOR,
    'A_FLAT_MAJOR_F_MINOR': LyriaScale.A_FLAT_MAJOR_F_MINOR,
    'D_FLAT_MAJOR_B_FLAT_MINOR': LyriaScale.D_FLAT_MAJOR_B_FLAT_MINOR,
    'G_FLAT_MAJOR_E_FLAT_MINOR': LyriaScale.G_FLAT_MAJOR_E_FLAT_MINOR,
    'CHROMATIC': LyriaScale.CHROMATIC,
  };
  
  return scaleMap[scale] || LyriaScale.C_MAJOR_A_MINOR;
}

export class GeminiMusicService {
  private genAI: GoogleGenAI | null = null;
  private initialized = false;

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Try to get API key from config first, then environment variable
    const apiKey = await ConfigManager.get('gemini.apiKey') || process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({
        apiKey: apiKey,
        apiVersion: 'v1alpha' // Lyria requires v1alpha
      });
    }
    this.initialized = true;
  }

  async generateMusic(params: GenerateMusicParams): Promise<Buffer> {
    await this.initialize();
    
    if (!this.genAI) {
      throw new GeminiError('Gemini API key is not configured. Set it using: kumiki config set gemini.apiKey <YOUR_API_KEY> or set GEMINI_API_KEY environment variable');
    }

    const duration = params.duration || 30; // デフォルト30秒
    const audioBuffers: Buffer[] = [];
    let isRecording = false;

    logger.info('Starting music generation', {
      prompt: params.prompt,
      prompts: params.prompts,
      duration,
      config: params.config,
    });

    try {
      // Lyria RealTimeセッションを作成
      const session = await this.genAI.live.music.connect({
        model: 'models/lyria-realtime-exp',
        callbacks: {
          onmessage: (message: unknown) => {
            // setupCompleteメッセージ
            const msg = message as { setupComplete?: boolean; serverContent?: { audioChunks?: Array<{ data?: string }> } };
            if (msg.setupComplete) {
              logger.debug('Music generation setup complete');
            }
            
            // 受信したオーディオチャンクを処理
            if (msg.serverContent?.audioChunks && isRecording) {
              logger.debug(`Received audio chunks: ${msg.serverContent.audioChunks.length}`);
              for (const chunk of msg.serverContent.audioChunks) {
                if (chunk.data) {
                  // Base64データをBufferに変換
                  const audioBuffer = Buffer.from(chunk.data, 'base64');
                  audioBuffers.push(audioBuffer);
                }
              }
            }
          },
          onerror: (error: Error) => {
            logger.error('Music session error', { error: error.message });
          },
          onclose: (event: unknown) => {
            const closeEvent = event as { code?: number; reason?: string };
            logger.debug('Lyria RealTime stream closed', {
              code: closeEvent?.code,
              reason: closeEvent?.reason
            });
          }
        }
      });

      // setupCompleteを待つ
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // プロンプトを設定
      if (params.prompts && params.prompts.length > 0) {
        logger.debug('Setting weighted prompts', { prompts: params.prompts });
        await session.setWeightedPrompts({ weightedPrompts: params.prompts });
      } else if (params.prompt) {
        // シンプルプロンプトを重み付きプロンプトに変換
        logger.debug('Setting simple prompt', { prompt: params.prompt });
        await session.setWeightedPrompts({
          weightedPrompts: [{ text: params.prompt, weight: 1.0 }]
        });
      }
      
      // 音楽生成設定を送信
      if (params.config) {
        const musicConfig = {
          bpm: params.config.bpm || 120,
          temperature: params.config.temperature || 1.0,
          guidance: params.config.guidance || 4.0,
          density: params.config.density || 0.7,
          brightness: params.config.brightness || 0.6,
          scale: getScaleEnum(params.config.scale) as unknown,
          mute_bass: params.config.mute_bass || false,
          mute_drums: params.config.mute_drums || false,
          only_bass_and_drums: params.config.only_bass_and_drums || false,
        };
        
        logger.debug('Setting music generation config', { config: musicConfig });
        await (session.setMusicGenerationConfig as (config: unknown) => Promise<void>)({ musicGenerationConfig: musicConfig });
      }

      // 音楽生成を開始
      isRecording = true;
      logger.info('Starting music playback');
      await (session.play as () => Promise<void>)();
      
      // 指定時間待機
      await new Promise(resolve => setTimeout(resolve, duration * 1000));

      // 録音を停止
      isRecording = false;
      logger.info('Stopping music recording');
      await (session.stop as () => Promise<void>)();
      
      logger.info(`Collected audio buffers: ${audioBuffers.length}`);
      
      // セッションを閉じる
      await (session.close as () => Promise<void>)();
      
      // WAVファイルに変換
      if (audioBuffers.length === 0) {
        throw new GeminiError('No audio data was generated', undefined);
      }

      const combinedPCM = Buffer.concat(audioBuffers);
      const wavData = pcmToWav(combinedPCM);
      
      logger.info('Music generation completed', {
        size: wavData.length,
        duration,
      });
      
      return wavData;
      
    } catch (error) {
      logger.error('Failed to generate music', {
        error: error instanceof Error ? error.message : String(error),
        errorDetails: error,
      });
      throw new GeminiError(
        error instanceof Error ? error.message : 'Failed to generate music',
        error
      );
    }
  }
}

// シングルトンインスタンス
export const geminiMusicService = new GeminiMusicService();