import { mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Get the application data directory
 */
export function getAppDataDir(): string {
  const home = homedir();
  return path.join(home, '.kumiki');
}

/**
 * Get the cache directory
 */
export function getCacheDir(subDir?: string): string {
  const appDataDir = getAppDataDir();
  const cacheDir = path.join(appDataDir, 'cache', subDir || '');
  return cacheDir;
}

/**
 * Get the temporary directory
 */
export function getTmpDir(subDir?: string): string {
  const appDataDir = getAppDataDir();
  const tmpDir = path.join(appDataDir, 'tmp', subDir || '');
  return tmpDir;
}

/**
 * Ensure directory exists
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get narration cache directory
 */
export function getNarrationCacheDir(): string {
  return getCacheDir('narration');
}

/**
 * Get generated music cache directory
 */
export function getGeneratedMusicCacheDir(): string {
  return getCacheDir('generated-music');
}

/**
 * Get generated image cache directory
 */
export function getGeneratedImageCacheDir(): string {
  return getCacheDir('generated-images');
}