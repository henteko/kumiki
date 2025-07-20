import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { BaseScene } from './base.js';
import { TextSceneRenderer } from './text.js';

import { FFmpegService } from '@/services/ffmpeg.js';
import { PuppeteerService } from '@/services/puppeteer.js';
import type { CompositeScene, Layer } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

export class CompositeSceneRenderer extends BaseScene<CompositeScene> {
  /**
   * Render static image with multiple layers
   */
  async renderStatic(): Promise<string> {
    const outputPath = this.getStaticOutputPath();
    const { width, height } = this.parseResolution();
    
    logger.info('Rendering composite scene to static image', {
      sceneId: this.scene.id,
      layers: this.scene.layers.length,
    });

    // Start with the background
    const backgroundHtml = this.getBackgroundHtml();
    
    // Sort layers by z-index (default to 0 if not specified)
    const sortedLayers = [...this.scene.layers].sort((a, b) => {
      const aZIndex = this.getZIndex(a);
      const bZIndex = this.getZIndex(b);
      return aZIndex - bZIndex;
    });
    
    // Build layers HTML
    const layersHtml = await Promise.all(
      sortedLayers.map((layer) => this.renderLayer(layer))
    );
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 0;
              width: ${width}px;
              height: ${height}px;
              overflow: hidden;
              position: relative;
              ${backgroundHtml}
            }
            .layer {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          ${layersHtml.join('\n')}
        </body>
      </html>
    `;

    const puppeteer = PuppeteerService.getInstance();
    await puppeteer.screenshot(html, {
      width,
      height,
      outputPath,
    });
    
    logger.info('Composite scene rendered to static image', {
      sceneId: this.scene.id,
      outputPath,
    });

    return outputPath;
  }

  /**
   * Get z-index for a layer
   */
  private getZIndex(layer: Layer): number {
    if (layer.type === 'text') {
      return layer.zIndex ?? 0;
    }
    if (layer.type === 'image') {
      return layer.zIndex ?? 0;
    }
    return 0;
  }

  /**
   * Render a single layer
   */
  private async renderLayer(layer: Layer): Promise<string> {
    if (layer.type === 'text') {
      return this.renderTextLayer(layer);
    }
    if (layer.type === 'image') {
      return this.renderImageLayer(layer);
    }
    // This should never happen due to TypeScript's exhaustive check
    throw new Error(`Unknown layer type`);
  }

  /**
   * Render text layer
   */
  private renderTextLayer(layer: Layer & { type: 'text' }): string {
    const { content, zIndex = 0, opacity = 1 } = layer;
    const { text, style, position } = content;
    const { width, height } = this.parseResolution();
    
    // Use TextSceneRenderer's static method to generate text element
    const textElement = TextSceneRenderer.generateTextElement(text, style, position, width, height);
    
    // Wrap with layer div and apply opacity
    return `
      <div class="layer" style="z-index: ${zIndex}; opacity: ${opacity};">
        ${textElement}
      </div>
    `;
  }

  /**
   * Render image layer
   */
  private async renderImageLayer(layer: Layer & { type: 'image' }): Promise<string> {
    const { content, zIndex = 0, opacity = 1 } = layer;
    const { src, fit, position } = content;
    
    // Read and encode image
    const imagePath = path.resolve(process.cwd(), src);
    const imageData = await fs.readFile(imagePath);
    const base64 = imageData.toString('base64');
    const mimeType = this.getMimeType(imagePath);
    const dataUri = `data:${mimeType};base64,${base64}`;
    
    // Build position styles
    const positionStyles = [];
    positionStyles.push('position: absolute');
    
    if (position.x === 'center') {
      positionStyles.push('left: 50%', 'transform: translateX(-50%)');
    } else {
      positionStyles.push(`left: ${position.x}px`);
    }
    
    if (position.y === 'center') {
      positionStyles.push('top: 50%');
      if (position.x === 'center') {
        // Replace the transform to handle both X and Y
        positionStyles[positionStyles.indexOf('transform: translateX(-50%)')] = 'transform: translate(-50%, -50%)';
      } else {
        positionStyles.push('transform: translateY(-50%)');
      }
    } else {
      positionStyles.push(`top: ${position.y}px`);
    }
    
    const fitStyles = this.getFitStyles(fit);
    
    return `
      <div class="layer" style="z-index: ${zIndex};">
        <img 
          src="${dataUri}" 
          style="${positionStyles.join('; ')}; ${fitStyles} opacity: ${opacity};"
          alt=""
        />
      </div>
    `;
  }


  /**
   * Get fit styles for images
   */
  private getFitStyles(fit: 'cover' | 'contain' | 'fill'): string {
    switch (fit) {
      case 'cover':
        return 'width: 100%; height: 100%; object-fit: cover;';
      case 'contain':
        return 'max-width: 100%; max-height: 100%; object-fit: contain;';
      case 'fill':
        return 'width: 100%; height: 100%; object-fit: fill;';
      default:
        return '';
    }
  }


  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/png';
    }
  }

  /**
   * Get background HTML styles
   */
  private getBackgroundHtml(): string {
    const background = this.scene.background;
    if (!background) {
      return 'background: #000000;';
    }

    switch (background.type) {
      case 'color':
        return `background: ${background.value};`;
      case 'gradient':
        return `background: ${background.value};`;
      case 'image':
        return `background: url("${background.value}") center/cover;`;
      default:
        return 'background: #000000;';
    }
  }

  /**
   * Render to video
   */
  async renderVideo(): Promise<string> {
    // First render to static image
    const imagePath = await this.renderStatic();
    const outputPath = this.getVideoOutputPath();

    // Convert static image to video with specified duration
    const ffmpeg = FFmpegService.getInstance();
    await ffmpeg.imageToVideo({
      input: imagePath,
      output: outputPath,
      duration: this.scene.duration,
      fps: this.options.fps,
      resolution: this.options.resolution
    });

    logger.info('Composite scene rendered to video', {
      sceneId: this.scene.id,
      outputPath,
    });

    return outputPath;
  }

  /**
   * Validate the scene
   */
  validate(): boolean {
    if (!this.scene.layers || this.scene.layers.length === 0) {
      logger.error('Composite scene must have at least one layer', {
        sceneId: this.scene.id,
      });
      return false;
    }

    for (const layer of this.scene.layers) {
      if (layer.type === 'image') {
        const imagePath = path.resolve(process.cwd(), layer.content.src);
        if (!existsSync(imagePath)) {
          logger.error('Image file not found', {
            sceneId: this.scene.id,
            path: imagePath,
          });
          return false;
        }
      }
    }

    return true;
  }
}