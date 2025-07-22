import { GenerateImageParams } from '@/services/gemini.js';

interface GenerateUrlObject {
  type: string;
  prompt?: string;
  style?: string;
  aspectRatio?: string;
  seed?: number;
}

/**
 * generate:// URLかどうかをチェック
 */
export function isGenerateUrl(src: string | object): boolean {
  if (typeof src === 'string') {
    return src.startsWith('generate://');
  }
  
  if (typeof src === 'object' && src !== null && 'type' in src) {
    const obj = src as GenerateUrlObject;
    return obj.type === 'generate';
  }
  
  return false;
}

/**
 * generate:// URLまたはオブジェクトからパラメータを抽出
 */
export function parseGenerateUrl(src: string | object): GenerateImageParams {
  if (typeof src === 'string') {
    // generate://プロンプト 形式
    if (!src.startsWith('generate://')) {
      throw new Error('Invalid generate URL format');
    }
    
    const prompt = src.slice('generate://'.length).trim();
    if (!prompt) {
      throw new Error('Empty prompt in generate URL');
    }
    
    return { prompt };
  }
  
  if (typeof src === 'object' && src !== null && 'type' in src) {
    // オブジェクト形式
    const obj = src as GenerateUrlObject;
    if (obj.type !== 'generate') {
      throw new Error('Invalid generate object type');
    }
    
    if (!obj.prompt || typeof obj.prompt !== 'string') {
      throw new Error('Missing or invalid prompt in generate object');
    }
    
    const params: GenerateImageParams = {
      prompt: obj.prompt,
    };
    
    // オプショナルパラメータ
    if (obj.style && ['photorealistic', 'illustration', 'anime', 'sketch'].includes(obj.style)) {
      params.style = obj.style as GenerateImageParams['style'];
    }
    
    if (obj.aspectRatio && typeof obj.aspectRatio === 'string') {
      params.aspectRatio = obj.aspectRatio;
    }
    
    if (obj.seed && typeof obj.seed === 'number') {
      params.seed = obj.seed;
    }
    
    return params;
  }
  
  throw new Error('Invalid generate URL or object format');
}