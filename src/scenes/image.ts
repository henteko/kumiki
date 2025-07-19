import { existsSync } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';

import { BaseScene } from '@/scenes/base.js';
import { PuppeteerService } from '@/services/puppeteer.js';
import type { ImageScene } from '@/types/index.js';
import { RenderError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';


export class ImageSceneRenderer extends BaseScene<ImageScene> {
  /**
   * Validate image scene configuration
   */
  validate(): boolean {
    if (!this.scene.content.src) {
      throw new RenderError(
        'Image source is required',
        'MISSING_IMAGE_SOURCE',
        { sceneId: this.scene.id },
      );
    }

    // Check if image file exists
    const imagePath = path.resolve(process.cwd(), this.scene.content.src);
    if (!existsSync(imagePath)) {
      throw new RenderError(
        `Image file not found: ${this.scene.content.src}`,
        'IMAGE_NOT_FOUND',
        { sceneId: this.scene.id, src: this.scene.content.src },
      );
    }

    return true;
  }

  /**
   * Render image scene to static image
   */
  async renderStatic(): Promise<string> {
    this.validate();
    await this.ensureOutputDirectory();

    logger.info('Rendering image scene to static image', {
      sceneId: this.scene.id,
      src: this.scene.content.src,
    });

    const { width, height } = this.parseResolution();
    const outputPath = this.getStaticOutputPath();

    // If no background and fit is 'fill', we can just copy the image
    if (!this.scene.background && this.scene.content.fit === 'fill') {
      const imagePath = path.resolve(process.cwd(), this.scene.content.src);
      await copyFile(imagePath, outputPath);
      
      logger.info('Image scene rendered (direct copy)', {
        sceneId: this.scene.id,
        outputPath,
      });
      
      return outputPath;
    }

    // Otherwise, use Puppeteer to render with proper positioning and background
    const html = await this.generateHTML(width, height);
    const puppeteer = PuppeteerService.getInstance();
    await puppeteer.screenshot(html, {
      width,
      height,
      outputPath,
    });

    logger.info('Image scene rendered to static image', {
      sceneId: this.scene.id,
      outputPath,
    });

    return outputPath;
  }

  /**
   * Render image scene to video (not implemented yet)
   */
  renderVideo(): Promise<string> {
    return Promise.reject(
      new RenderError(
        'Video rendering not implemented yet',
        'NOT_IMPLEMENTED',
        { sceneId: this.scene.id },
      ),
    );
  }

  /**
   * Generate HTML for image scene
   */
  private async generateHTML(width: number, height: number): Promise<string> {
    const { src, fit, position } = this.scene.content;
    const background = this.scene.background;

    // Get absolute image path
    const imagePath = path.resolve(process.cwd(), src);
    
    // Read image as base64
    const imageBuffer = await readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    
    // Detect image format from file extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                     ext === '.png' ? 'image/png' : 
                     ext === '.gif' ? 'image/gif' : 
                     ext === '.webp' ? 'image/webp' : 'image/png';
    
    const imageUrl = `data:${mimeType};base64,${imageBase64}`;

    // Calculate image position
    const imageX = this.calculatePosition(position.x, width, 0);
    const imageY = this.calculatePosition(position.y, height, 0);

    // Generate background styles
    const backgroundStyles = this.getBackgroundStyles(background);

    // Generate image fit styles
    const fitStyles = this.getImageFitStyles(fit);

    // Generate styles
    const styles = `
      .image-container {
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: ${position.y === 'center' ? 'center' : 'flex-start'};
        justify-content: ${position.x === 'center' ? 'center' : 'flex-start'};
      }
      
      .image {
        ${fitStyles}
        max-width: 100%;
        max-height: 100%;
      }
      
      ${backgroundStyles}
    `;

    // Generate HTML content
    const content = `
      <div class="scene-background"></div>
      <div class="image-container" style="${position.x !== 'center' ? `padding-left: ${imageX}px;` : ''} ${position.y !== 'center' ? `padding-top: ${imageY}px;` : ''}">
        <img class="image" src="${imageUrl}" alt="">
      </div>
    `;

    const puppeteer = PuppeteerService.getInstance();
    const html = puppeteer.generateHTML(content, styles);
    
    // Debug: Log the image URL
    logger.debug('Image scene HTML', { 
      imageUrl, 
      imagePath,
      exists: existsSync(imagePath) 
    });
    
    return html;
  }

  /**
   * Get image fit styles
   */
  private getImageFitStyles(fit: 'cover' | 'contain' | 'fill'): string {
    switch (fit) {
      case 'cover':
        return `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `;
      case 'contain':
        return `
          width: 100%;
          height: 100%;
          object-fit: contain;
        `;
      case 'fill':
        return `
          width: 100%;
          height: 100%;
          object-fit: fill;
        `;
      default:
        return '';
    }
  }

  /**
   * Get background styles
   */
  private getBackgroundStyles(background?: { type: string; value: string }): string {
    if (!background) {
      return `
        .scene-background {
          position: absolute;
          width: 100%;
          height: 100%;
          background: #000000;
        }
      `;
    }

    let backgroundValue = '';
    switch (background.type) {
      case 'color':
        backgroundValue = background.value;
        break;
      case 'gradient':
        backgroundValue = background.value;
        break;
      case 'image':
        backgroundValue = `url("${background.value}") center/cover`;
        break;
    }

    return `
      .scene-background {
        position: absolute;
        width: 100%;
        height: 100%;
        background: ${backgroundValue};
      }
    `;
  }
}