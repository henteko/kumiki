import { GoogleGenAI, Modality } from '@google/genai';

import { KumikiError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

export class GeminiError extends KumikiError {
  constructor(message: string, details?: unknown) {
    super(message, 'GEMINI_ERROR', details);
  }
}

export interface GenerateImageParams {
  prompt: string;
  style?: 'photorealistic' | 'illustration' | 'anime' | 'sketch';
  aspectRatio?: string;
  seed?: number;
}

export class GeminiImageService {
  private genAI: GoogleGenAI | null = null;
  private initialized = false;

  private initialize(): void {
    if (this.initialized) return;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({
        apiKey: apiKey,
      });
    }
    this.initialized = true;
  }

  async generateImage(params: GenerateImageParams): Promise<Buffer> {
    this.initialize();
    
    if (!this.genAI) {
      throw new GeminiError('GEMINI_API_KEY environment variable is not set');
    }

    logger.info('Generating image with Gemini', {
      prompt: params.prompt,
      style: params.style,
      aspectRatio: params.aspectRatio,
    });

    try {
      const enhancedPrompt = this.enhancePrompt(params.prompt, params.style, params.aspectRatio);
      
      logger.info('Using Gemini 2.0 Flash model', { enhancedPrompt });

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: enhancedPrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      // レスポンスから画像データを抽出
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No candidates in response');
      }

      const candidate = response.candidates[0];
      if (!candidate || !candidate.content || !candidate.content.parts) {
        throw new Error('No content parts in response');
      }

      // 画像データを探す
      let imageData: Buffer | null = null;
      
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
          imageData = Buffer.from(part.inlineData.data!, 'base64');
          break;
        }
      }

      if (!imageData) {
        throw new Error('No image data found in response');
      }

      return imageData;
    } catch (error) {
      if (error instanceof GeminiError) {
        throw error;
      }
      
      logger.error('Failed to generate image', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        params 
      });
      throw new GeminiError(
        error instanceof Error ? error.message : 'Failed to generate image', 
        error
      );
    }
  }

  /**
   * プロンプトを最適化
   */
  private enhancePrompt(prompt: string, style?: string, aspectRatio?: string): string {
    const parts: string[] = [prompt];
    
    if (style) {
      const styleDescriptions: Record<string, string> = {
        photorealistic: 'photorealistic, high quality photograph, professional photography',
        illustration: 'digital illustration, artistic style, clean and modern',
        anime: 'anime style, japanese animation, manga art',
        sketch: 'pencil sketch, hand drawn, artistic sketch',
      };
      
      const styleDesc = styleDescriptions[style];
      if (styleDesc) {
        parts.push(styleDesc);
      }
    }

    if (aspectRatio) {
      const aspectDescriptions: Record<string, string> = {
        '16:9': 'widescreen format, horizontal orientation',
        '9:16': 'vertical format, portrait orientation',
        '1:1': 'square format',
        '4:3': 'standard format',
      };
      
      const aspectDesc = aspectDescriptions[aspectRatio];
      if (aspectDesc) {
        parts.push(aspectDesc);
      }
    }
    
    return parts.join('. ') + '.';
  }
}

// シングルトンインスタンス
export const geminiImageService = new GeminiImageService();