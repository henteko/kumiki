import { existsSync } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';

import { BaseScene } from '@/scenes/base.js';
import { FFmpegService } from '@/services/ffmpeg.js';
import { PuppeteerService } from '@/services/puppeteer.js';
import type { ImageScene } from '@/types/index.js';
import { RenderError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';


export class ImageSceneRenderer extends BaseScene<ImageScene> {
  /**
   * Generate image element HTML (for reuse in CompositeSceneRenderer)
   */
  static async generateImageElement(
    src: string,
    fit: 'cover' | 'contain' | 'fill',
    position: { x: number | 'center'; y: number | 'center' },
    _width: number,
    _height: number
  ): Promise<string> {
    // Get absolute image path
    const imagePath = path.resolve(process.cwd(), src);
    
    // Read image as base64
    const imageBuffer = await readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    
    // Detect image format from file extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ImageSceneRenderer.getMimeTypeStatic(ext);
    
    const imageUrl = `data:${mimeType};base64,${imageBase64}`;

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

    // Get fit styles
    const fitStyles = ImageSceneRenderer.getImageFitStylesStatic(fit);
    
    const imageStyleParts = [
      ...positionStyles,
      ...fitStyles,
      'max-width: 100%',
      'max-height: 100%'
    ];

    const imageStyles = imageStyleParts.join('; ');

    return `<img src="${imageUrl}" style="${imageStyles}" alt="" />`;
  }

  /**
   * Get MIME type from file extension (static version for reuse)
   */
  private static getMimeTypeStatic(ext: string): string {
    switch (ext.toLowerCase()) {
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
   * Get image fit styles (static version for reuse)
   */
  private static getImageFitStylesStatic(fit: 'cover' | 'contain' | 'fill'): string[] {
    switch (fit) {
      case 'cover':
        return ['width: 100%', 'height: 100%', 'object-fit: cover'];
      case 'contain':
        return ['object-fit: contain'];
      case 'fill':
        return ['width: 100%', 'height: 100%', 'object-fit: fill'];
      default:
        return [];
    }
  }
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
   * Render image scene to video
   */
  async renderVideo(): Promise<string> {
    this.validate();
    
    logger.info('Rendering image scene to video', {
      sceneId: this.scene.id,
      duration: this.scene.duration,
    });

    // First render static image
    const imagePath = await this.renderStatic();
    
    // Convert image to video using FFmpeg
    const videoPath = this.getVideoOutputPath();
    const ffmpeg = FFmpegService.getInstance();
    
    await ffmpeg.imageToVideo({
      input: imagePath,
      output: videoPath,
      duration: this.scene.duration,
      fps: this.options.fps,
      resolution: this.options.resolution,
    });

    logger.info('Image scene rendered to video', {
      sceneId: this.scene.id,
      outputPath: videoPath,
    });

    return videoPath;
  }

  /**
   * Generate HTML for image scene
   */
  private async generateHTML(width: number, height: number): Promise<string> {
    const { src, fit, position } = this.scene.content;
    const background = this.scene.background;

    // Generate background styles
    const backgroundStyles = this.getBackgroundStyles(background);

    // Generate styles
    const styles = `
      ${backgroundStyles}
    `;

    // Use static method to generate image element
    const imageElement = await ImageSceneRenderer.generateImageElement(src, fit, position, width, height);

    // Generate HTML content
    const content = `
      <div class="scene-background"></div>
      ${imageElement}
    `;

    const puppeteer = PuppeteerService.getInstance();
    const html = puppeteer.generateHTML(content, styles);
    
    return html;
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