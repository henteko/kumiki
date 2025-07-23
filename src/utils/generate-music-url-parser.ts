import type { GenerateMusicSource, MusicGenerationConfig, WeightedPrompt } from '@/types/index.js';

export interface GenerateMusicParams {
  prompt?: string;
  prompts?: WeightedPrompt[];
  config?: MusicGenerationConfig;
  duration?: number;
  seed?: number;
}

/**
 * generate:// URL or GenerateMusicSourceかどうかをチェック
 */
export function isGenerateMusicUrl(src: string | GenerateMusicSource): boolean {
  if (typeof src === 'string') {
    return src.startsWith('generate://');
  }
  
  if (typeof src === 'object' && src !== null && 'type' in src) {
    return src.type === 'generate';
  }
  
  return false;
}

/**
 * generate:// URLまたはGenerateMusicSourceオブジェクトからパラメータを抽出
 */
export function parseGenerateMusicUrl(src: string | GenerateMusicSource): GenerateMusicParams {
  if (typeof src === 'string') {
    // generate://プロンプト 形式
    if (!src.startsWith('generate://')) {
      throw new Error('Invalid generate music URL format');
    }
    
    const prompt = src.slice('generate://'.length).trim();
    if (!prompt) {
      throw new Error('Empty prompt in generate music URL');
    }
    
    return { prompt };
  }
  
  if (typeof src === 'object' && src !== null && 'type' in src) {
    // オブジェクト形式
    if (src.type !== 'generate') {
      throw new Error('Invalid generate music source type');
    }
    
    // promptかpromptsのいずれかが必須
    if (!src.prompt && (!src.prompts || src.prompts.length === 0)) {
      throw new Error('Either prompt or prompts must be specified in generate music source');
    }
    
    const params: GenerateMusicParams = {};
    
    // シンプルプロンプト
    if (src.prompt) {
      params.prompt = src.prompt;
    }
    
    // 重み付きプロンプト
    if (src.prompts && src.prompts.length > 0) {
      params.prompts = src.prompts;
    }
    
    // オプショナルパラメータ
    if (src.config) {
      params.config = src.config;
    }
    
    if (src.duration && typeof src.duration === 'number') {
      params.duration = src.duration;
    }
    
    if (src.seed && typeof src.seed === 'number') {
      params.seed = src.seed;
    }
    
    return params;
  }
  
  throw new Error('Invalid generate music URL or object format');
}