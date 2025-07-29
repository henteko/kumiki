import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { z } from 'zod';

import { logger } from '@/utils/logger.js';

const ConfigSchema = z.object({
  gemini: z.object({
    apiKey: z.string().optional(),
  }).optional(),
});

type Config = z.infer<typeof ConfigSchema>;

export class ConfigManager {
  private static configDir = path.join(os.homedir(), '.kumiki');
  private static configFile = path.join(ConfigManager.configDir, 'config.json');

  static async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create config directory', { error });
      throw error;
    }
  }

  static async load(): Promise<Config> {
    try {
      await this.ensureConfigDir();
      const data = await fs.readFile(this.configFile, 'utf-8');
      const config = JSON.parse(data) as unknown;
      return ConfigSchema.parse(config);
    } catch (error) {
      // If file doesn't exist or is invalid, return empty config
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      logger.warning('Failed to load config, using defaults');
      return {};
    }
  }

  static async save(config: Config): Promise<void> {
    try {
      await this.ensureConfigDir();
      const validated = ConfigSchema.parse(config);
      await fs.writeFile(
        this.configFile,
        JSON.stringify(validated, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to save config', { error });
      throw error;
    }
  }

  static async get(key: string): Promise<string | undefined> {
    const config = await this.load();
    const keys = key.split('.');
    let value: unknown = config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }
    
    return typeof value === 'string' ? value : undefined;
  }

  static async set(key: string, value: string): Promise<void> {
    const config = await this.load();
    const keys = key.split('.');
    let target: Record<string, unknown> = config as Record<string, unknown>;
    
    // Navigate to the parent object, creating nested objects as needed
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!k) continue;
      
      if (!target[k] || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k] as Record<string, unknown>;
    }
    
    // Set the final value
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      target[lastKey] = value;
    }
    
    await this.save(config);
  }

  static async unset(key: string): Promise<void> {
    const config = await this.load();
    const keys = key.split('.');
    let target: Record<string, unknown> = config as Record<string, unknown>;
    
    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!k) return;
      
      if (!target[k] || typeof target[k] !== 'object') {
        return; // Key doesn't exist
      }
      target = target[k] as Record<string, unknown>;
    }
    
    // Delete the final key
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      delete target[lastKey];
    }
    
    await this.save(config);
  }

  static async list(): Promise<Config> {
    return this.load();
  }

  static getConfigPath(): string {
    return this.configFile;
  }
}