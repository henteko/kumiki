import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import { FFmpegService } from '@/services/ffmpeg.js';
import type { GenerateMusicParams } from '@/utils/generate-music-url-parser.js';
import { logger } from '@/utils/logger.js';

interface MusicCacheEntry {
  key: string;
  params: GenerateMusicParams;
  metadata: {
    generatedAt: string;
    model: string;
    fileSize: number;
    mimeType: string;
    sampleRate: number;
    channels: number;
    actualDuration?: number;
  };
  usage: {
    lastUsed: string;
    useCount: number;
    projects: string[];
  };
}

interface MusicCacheManifest {
  version: string;
  entries: MusicCacheEntry[];
}

export class MusicCache {
  private cacheDir: string;
  private manifestPath: string;
  private manifest: MusicCacheManifest | null = null;
  private initialized = false;

  constructor() {
    this.cacheDir = path.join(process.cwd(), '.kumiki-cache', 'generated-music');
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // キャッシュディレクトリを作成
    await mkdir(this.cacheDir, { recursive: true });

    // マニフェストを読み込み
    await this.loadManifest();
    this.initialized = true;
  }

  private async loadManifest(): Promise<void> {
    try {
      if (existsSync(this.manifestPath)) {
        const data = await readFile(this.manifestPath, 'utf-8');
        this.manifest = JSON.parse(data) as MusicCacheManifest;
      } else {
        this.manifest = {
          version: '1.0',
          entries: [],
        };
        await this.saveManifest();
      }
    } catch (error) {
      logger.error('Failed to load music cache manifest', { error });
      this.manifest = {
        version: '1.0',
        entries: [],
      };
    }
  }

  private async saveManifest(): Promise<void> {
    if (!this.manifest) return;

    try {
      await writeFile(
        this.manifestPath,
        JSON.stringify(this.manifest, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to save music cache manifest', { error });
    }
  }

  generateCacheKey(params: GenerateMusicParams): string {
    const normalized = JSON.stringify({
      prompt: params.prompt,
      prompts: params.prompts,
      config: params.config,
      duration: params.duration,
      seed: params.seed,
      model: 'models/lyria-realtime-exp',
    }, Object.keys(params).sort());
    
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  async get(key: string, projectPath?: string): Promise<string | null> {
    if (!this.manifest) return null;

    const entry = this.manifest.entries.find(e => e.key === key);
    if (!entry) return null;

    // MP3ファイルを探す（新しい形式）
    let filePath = path.join(this.cacheDir, `${key}.mp3`);
    if (!existsSync(filePath)) {
      // 古いWAVファイルも確認（後方互換性）
      filePath = path.join(this.cacheDir, `${key}.wav`);
      if (!existsSync(filePath)) {
        // キャッシュファイルが存在しない場合はエントリを削除
        this.manifest.entries = this.manifest.entries.filter(e => e.key !== key);
        await this.saveManifest();
        return null;
      }
    }

    // 使用統計を更新
    entry.usage.lastUsed = new Date().toISOString();
    entry.usage.useCount++;
    if (projectPath && !entry.usage.projects.includes(projectPath)) {
      entry.usage.projects.push(projectPath);
    }
    await this.saveManifest();

    return filePath;
  }

  async save(
    key: string,
    data: Buffer,
    params: GenerateMusicParams,
    projectPath?: string
  ): Promise<string> {
    if (!this.manifest) {
      throw new Error('Music cache not initialized');
    }

    // 一時的にWAVファイルとして保存
    const tempWavPath = path.join(this.cacheDir, `${key}_temp.wav`);
    await writeFile(tempWavPath, data);

    // MP3に変換
    const mp3Path = path.join(this.cacheDir, `${key}.mp3`);
    const ffmpeg = FFmpegService.getInstance();
    
    try {
      // WAVをMP3に変換（ビットレート192kbps）
      await ffmpeg.execute('ffmpeg', [
        '-i', tempWavPath,
        '-codec:a', 'libmp3lame',
        '-b:a', '192k',
        '-y',
        mp3Path
      ]);
      
      // 一時WAVファイルを削除
      await unlink(tempWavPath);
    } catch (error) {
      // 変換に失敗した場合は一時ファイルをクリーンアップ
      if (existsSync(tempWavPath)) {
        await unlink(tempWavPath);
      }
      throw error;
    }

    // MP3ファイル情報を取得
    const stats = await stat(mp3Path);

    // マニフェストエントリを作成
    const entry: MusicCacheEntry = {
      key,
      params,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'models/lyria-realtime-exp',
        fileSize: stats.size,
        mimeType: 'audio/mp3',
        sampleRate: 48000,
        channels: 2,
        actualDuration: params.duration,
      },
      usage: {
        lastUsed: new Date().toISOString(),
        useCount: 1,
        projects: projectPath ? [projectPath] : [],
      },
    };

    // 既存のエントリを更新または新規追加
    const existingIndex = this.manifest.entries.findIndex(e => e.key === key);
    if (existingIndex >= 0) {
      this.manifest.entries[existingIndex] = entry;
    } else {
      this.manifest.entries.push(entry);
    }

    await this.saveManifest();
    return mp3Path;
  }

  async clear(options?: { olderThan?: number }): Promise<number> {
    if (!this.manifest) return 0;

    let clearedCount = 0;
    const now = Date.now();
    const newEntries: MusicCacheEntry[] = [];

    for (const entry of this.manifest.entries) {
      const shouldDelete = options?.olderThan
        ? now - new Date(entry.usage.lastUsed).getTime() > options.olderThan
        : true;

      if (shouldDelete) {
        // MP3とWAV両方を削除試行
        const mp3Path = path.join(this.cacheDir, `${entry.key}.mp3`);
        const wavPath = path.join(this.cacheDir, `${entry.key}.wav`);
        try {
          if (existsSync(mp3Path)) {
            await unlink(mp3Path);
            clearedCount++;
          } else if (existsSync(wavPath)) {
            await unlink(wavPath);
            clearedCount++;
          }
        } catch (error) {
          logger.error('Failed to delete cached music file', { mp3Path, wavPath, error });
        }
      } else {
        newEntries.push(entry);
      }
    }

    this.manifest.entries = newEntries;
    await this.saveManifest();
    return clearedCount;
  }

  getStats(): {
    totalFiles: number;
    totalSize: number;
    oldestFile: Date | null;
    newestFile: Date | null;
  } {
    if (!this.manifest) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: null,
        newestFile: null,
      };
    }

    let totalSize = 0;
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;

    // マニフェストからサイズと日付を集計
    for (const entry of this.manifest.entries) {
      // MP3ファイルを優先、なければWAVファイル
      let filePath = path.join(this.cacheDir, `${entry.key}.mp3`);
      if (!existsSync(filePath)) {
        filePath = path.join(this.cacheDir, `${entry.key}.wav`);
      }
      if (existsSync(filePath)) {
        totalSize += entry.metadata.fileSize;
        
        const generatedDate = new Date(entry.metadata.generatedAt);
        if (!oldestDate || generatedDate < oldestDate) {
          oldestDate = generatedDate;
        }
        if (!newestDate || generatedDate > newestDate) {
          newestDate = generatedDate;
        }
      }
    }

    return {
      totalFiles: this.manifest.entries.length,
      totalSize,
      oldestFile: oldestDate,
      newestFile: newestDate,
    };
  }

  getAllCachedFiles(): Array<{ path: string; params: GenerateMusicParams; metadata: MusicCacheEntry['metadata'] }> {
    if (!this.manifest) return [];

    const files = [];
    for (const entry of this.manifest.entries) {
      // MP3ファイルを優先、なければWAVファイル
      let filePath = path.join(this.cacheDir, `${entry.key}.mp3`);
      if (!existsSync(filePath)) {
        filePath = path.join(this.cacheDir, `${entry.key}.wav`);
      }
      if (existsSync(filePath)) {
        files.push({
          path: filePath,
          params: entry.params,
          metadata: entry.metadata,
        });
      }
    }
    return files;
  }
}

// シングルトンインスタンス
export const musicCache = new MusicCache();

// キャッシュキー生成のエクスポート
export function generateMusicCacheKey(params: GenerateMusicParams): string {
  return musicCache.generateCacheKey(params);
}