import { BaseScene } from '@/scenes/base.js';
import type { Scene, SceneRenderOptions } from '@/types/index.js';
import { RenderError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';


type SceneRendererConstructor = new (scene: Scene, options: SceneRenderOptions) => BaseScene;

export class SceneFactory {
  private static renderers = new Map<string, SceneRendererConstructor>();

  /**
   * Register a scene renderer
   */
  static register(type: string, renderer: SceneRendererConstructor): void {
    logger.debug('Registering scene renderer', { type });
    this.renderers.set(type, renderer);
  }

  /**
   * Create a scene renderer instance
   */
  static create(scene: Scene, options: SceneRenderOptions): BaseScene {
    const RendererClass = this.renderers.get(scene.type);
    
    if (!RendererClass) {
      throw new RenderError(
        `Unknown scene type: ${scene.type}`,
        'UNKNOWN_SCENE_TYPE',
        { type: scene.type },
      );
    }

    logger.debug('Creating scene renderer', { 
      type: scene.type, 
      sceneId: scene.id 
    });

    return new RendererClass(scene, options);
  }

  /**
   * Get all registered scene types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Check if a scene type is registered
   */
  static isTypeRegistered(type: string): boolean {
    return this.renderers.has(type);
  }
}