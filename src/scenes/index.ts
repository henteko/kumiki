import { BaseScene } from '@/scenes/base.js';
import { SceneFactory } from '@/scenes/factory.js';
import { ImageSceneRenderer } from '@/scenes/image.js';
import { TextSceneRenderer } from '@/scenes/text.js';
import type { Scene, SceneRenderOptions } from '@/types/index.js';

// Register all scene renderers
export function registerSceneRenderers(): void {
  // Type assertion is needed because TypeScript cannot verify the generic constraint
  SceneFactory.register('text', TextSceneRenderer as unknown as new (scene: Scene, options: SceneRenderOptions) => BaseScene);
  SceneFactory.register('image', ImageSceneRenderer as unknown as new (scene: Scene, options: SceneRenderOptions) => BaseScene);
  // TODO: Add video scene renderer when implemented
  // SceneFactory.register('video', VideoSceneRenderer);
}

// Export all scene-related modules
export { BaseScene } from './base.js';
export { SceneFactory } from './factory.js';
export { TextSceneRenderer } from './text.js';
export { ImageSceneRenderer } from './image.js';