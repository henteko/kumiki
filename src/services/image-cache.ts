import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { GenerateImageParams } from './gemini.js';

import { getGeneratedImageCacheDir } from '@/utils/app-dirs.js';
import { logger } from '@/utils/logger.js';


interface CacheEntry {
  key: string;
  params: GenerateImageParams;
  metadata: {
    generatedAt: string;
    model: string;
    fileSize: number;
    mimeType: string;
  };
  usage: {
    lastUsed: string;
    useCount: number;
    projects: string[];
  };
}

interface CacheManifest {
  version: string;
  entries: CacheEntry[];
}

export class ImageCache {
  private cacheDir: string;
  private manifestPath: string;
  private manifest: CacheManifest | null = null;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || getGeneratedImageCacheDir();
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');
  }

  async initialize(): Promise<void> {
    // キャッシュディレクトリを作成
    await fs.mkdir(this.cacheDir, { recursive: true });
    
    // マニフェストを読み込む
    await this.loadManifest();
  }

  /**
   * キャッシュから画像を取得
   */
  async get(cacheKey: string): Promise<string | null> {
    const entry = this.manifest?.entries.find(e => e.key === cacheKey);
    if (!entry) {
      return null;
    }

    const imagePath = path.join(this.cacheDir, `${cacheKey}.png`);
    
    try {
      await fs.access(imagePath);
      
      // 使用統計を更新
      entry.usage.lastUsed = new Date().toISOString();
      entry.usage.useCount++;
      await this.saveManifest();
      
      logger.debug('Cache hit', { cacheKey, path: imagePath });
      return imagePath;
    } catch {
      // ファイルが存在しない場合はエントリを削除
      if (this.manifest) {
        this.manifest.entries = this.manifest.entries.filter(e => e.key !== cacheKey);
        await this.saveManifest();
      }
      return null;
    }
  }

  /**
   * 画像をキャッシュに保存
   */
  async save(cacheKey: string, imageData: Buffer, params: GenerateImageParams): Promise<string> {
    const imagePath = path.join(this.cacheDir, `${cacheKey}.png`);
    
    // 画像データを保存
    await fs.writeFile(imagePath, imageData);
    
    // ファイルサイズを取得
    const stats = await fs.stat(imagePath);
    
    // マニフェストに追加
    const entry: CacheEntry = {
      key: cacheKey,
      params,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'gemini-2.0-flash-preview-image-generation',
        fileSize: stats.size,
        mimeType: 'image/png',
      },
      usage: {
        lastUsed: new Date().toISOString(),
        useCount: 1,
        projects: [],
      },
    };
    
    if (!this.manifest) {
      this.manifest = { version: '1.0', entries: [] };
    }
    
    // 既存のエントリを削除して新規追加
    this.manifest.entries = this.manifest.entries.filter(e => e.key !== cacheKey);
    this.manifest.entries.push(entry);
    
    await this.saveManifest();
    
    logger.info('Image cached', { 
      cacheKey, 
      path: imagePath,
      size: stats.size,
      prompt: params.prompt,
    });
    
    return imagePath;
  }

  /**
   * キャッシュをクリア
   */
  async clear(options?: { olderThan?: Date }): Promise<void> {
    if (!this.manifest) {
      return;
    }

    let entriesToRemove: CacheEntry[] = [];

    if (options?.olderThan) {
      entriesToRemove = this.manifest.entries.filter(entry => {
        const lastUsed = new Date(entry.usage.lastUsed);
        return lastUsed < options.olderThan!;
      });
    } else {
      entriesToRemove = [...this.manifest.entries];
    }

    // ファイルを削除
    for (const entry of entriesToRemove) {
      const imagePath = path.join(this.cacheDir, `${entry.key}.png`);
      try {
        await fs.unlink(imagePath);
        logger.debug('Removed cached image', { key: entry.key });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warning('Failed to remove cached image', { 
          key: entry.key, 
          error: errorMessage
        });
      }
    }

    // マニフェストを更新
    if (options?.olderThan) {
      this.manifest.entries = this.manifest.entries.filter(
        entry => !entriesToRemove.includes(entry)
      );
    } else {
      this.manifest.entries = [];
    }

    await this.saveManifest();
    
    logger.info('Cache cleared', { 
      removed: entriesToRemove.length,
      remaining: this.manifest.entries.length,
    });
  }

  /**
   * キャッシュのサイズを取得
   */
  async getSize(): Promise<{ totalSize: number; fileCount: number }> {
    if (!this.manifest) {
      return { totalSize: 0, fileCount: 0 };
    }

    let totalSize = 0;
    let fileCount = 0;

    for (const entry of this.manifest.entries) {
      const imagePath = path.join(this.cacheDir, `${entry.key}.png`);
      try {
        const stats = await fs.stat(imagePath);
        totalSize += stats.size;
        fileCount++;
      } catch {
        // ファイルが存在しない場合は無視
      }
    }

    return { totalSize, fileCount };
  }

  /**
   * キャッシュ状況を取得
   */
  async getStatus(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    const { totalSize, fileCount } = await this.getSize();
    
    if (!this.manifest || this.manifest.entries.length === 0) {
      return { totalFiles: fileCount, totalSize };
    }

    const sortedEntries = [...this.manifest.entries].sort(
      (a, b) => new Date(a.metadata.generatedAt).getTime() - new Date(b.metadata.generatedAt).getTime()
    );

    return {
      totalFiles: fileCount,
      totalSize,
      oldestEntry: sortedEntries[0] ? new Date(sortedEntries[0].metadata.generatedAt) : undefined,
      newestEntry: sortedEntries.length > 0 ? new Date(sortedEntries[sortedEntries.length - 1]!.metadata.generatedAt) : undefined,
    };
  }

  /**
   * マニフェストを読み込む
   */
  private async loadManifest(): Promise<void> {
    try {
      const data = await fs.readFile(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(data) as CacheManifest;
      logger.debug('Manifest loaded', { entries: this.manifest.entries.length });
    } catch {
      // マニフェストが存在しない場合は新規作成
      this.manifest = { version: '1.0', entries: [] };
      logger.debug('Created new manifest');
    }
  }

  /**
   * マニフェストを保存
   */
  private async saveManifest(): Promise<void> {
    if (!this.manifest) {
      return;
    }

    await fs.writeFile(
      this.manifestPath,
      JSON.stringify(this.manifest, null, 2),
      'utf-8'
    );
  }
}

/**
 * キャッシュキーを生成
 */
export function generateCacheKey(params: GenerateImageParams): string {
  const normalized = JSON.stringify({
    prompt: params.prompt,
    style: params.style || 'photorealistic',
    aspectRatio: params.aspectRatio || '16:9',
    seed: params.seed,
  }, Object.keys(params).sort());
  
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

// シングルトンインスタンス
export const imageCache = new ImageCache();