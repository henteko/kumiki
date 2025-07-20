import { BaseScene } from '@/scenes/base.js';
import { CompositeSceneRenderer } from '@/scenes/composite.js';
import { SceneFactory } from '@/scenes/factory.js';
import { ImageSceneRenderer } from '@/scenes/image.js';
import { TextSceneRenderer } from '@/scenes/text.js';
import { VideoSceneRenderer } from '@/scenes/video.js';
import type { Scene, SceneRenderOptions } from '@/types/index.js';

// Register all scene renderers
export function registerSceneRenderers(): void {
  // Type assertion is needed because TypeScript cannot verify the generic constraint
  SceneFactory.register('text', TextSceneRenderer as unknown as new (scene: Scene, options: SceneRenderOptions) => BaseScene);
  SceneFactory.register('image', ImageSceneRenderer as unknown as new (scene: Scene, options: SceneRenderOptions) => BaseScene);
  SceneFactory.register('video', VideoSceneRenderer as unknown as new (scene: Scene, options: SceneRenderOptions) => BaseScene);
  SceneFactory.register('composite', CompositeSceneRenderer as unknown as new (scene: Scene, options: SceneRenderOptions) => BaseScene);
}

// Export all scene-related modules
export { BaseScene } from './base.js';
export { SceneFactory } from './factory.js';
export { TextSceneRenderer } from './text.js';
export { ImageSceneRenderer } from './image.js';
export { VideoSceneRenderer } from './video.js';
export { CompositeSceneRenderer } from './composite.js';