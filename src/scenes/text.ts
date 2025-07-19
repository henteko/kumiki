import { BaseScene } from '@/scenes/base.js';
import { FFmpegService } from '@/services/ffmpeg.js';
import { PuppeteerService } from '@/services/puppeteer.js';
import type { TextScene } from '@/types/index.js';
import { RenderError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';


export class TextSceneRenderer extends BaseScene<TextScene> {
  /**
   * Validate text scene configuration
   */
  validate(): boolean {
    if (!this.scene.content.text) {
      throw new RenderError(
        'Text content is required',
        'MISSING_TEXT_CONTENT',
        { sceneId: this.scene.id },
      );
    }

    if (!this.scene.content.style) {
      throw new RenderError(
        'Text style is required',
        'MISSING_TEXT_STYLE',
        { sceneId: this.scene.id },
      );
    }

    return true;
  }

  /**
   * Render text scene to static image
   */
  async renderStatic(): Promise<string> {
    this.validate();
    await this.ensureOutputDirectory();

    logger.info('Rendering text scene to static image', {
      sceneId: this.scene.id,
      text: this.scene.content.text.substring(0, 50),
    });

    const { width, height } = this.parseResolution();
    const outputPath = this.getStaticOutputPath();

    // Generate HTML content
    const html = this.generateHTML(width, height);

    // Take screenshot
    const puppeteer = PuppeteerService.getInstance();
    await puppeteer.screenshot(html, {
      width,
      height,
      outputPath,
    });

    logger.info('Text scene rendered to static image', {
      sceneId: this.scene.id,
      outputPath,
    });

    return outputPath;
  }

  /**
   * Render text scene to video
   */
  async renderVideo(): Promise<string> {
    this.validate();
    
    logger.info('Rendering text scene to video', {
      sceneId: this.scene.id,
      duration: this.scene.duration,
    });

    // First render static image
    const imagePath = await this.renderStatic();
    
    // Get animation filter if available
    const animationFilter = this.getAnimationFilter();
    
    // Convert image to video using FFmpeg
    const videoPath = this.getVideoOutputPath();
    const ffmpeg = FFmpegService.getInstance();
    
    await ffmpeg.imageToVideo({
      input: imagePath,
      output: videoPath,
      duration: this.scene.duration,
      fps: this.options.fps,
      resolution: this.options.resolution,
      filter: animationFilter,
    });

    logger.info('Text scene rendered to video', {
      sceneId: this.scene.id,
      outputPath: videoPath,
      animation: this.scene.animation ? this.scene.animation.type : 'none',
    });

    return videoPath;
  }

  /**
   * Generate HTML for text scene
   */
  private generateHTML(width: number, height: number): string {
    const { text, style, position } = this.scene.content;
    const background = this.scene.background;

    // Calculate text position
    const textX = this.calculatePosition(position.x, width, 0);
    const textY = this.calculatePosition(position.y, height, 0);

    // Generate background styles
    const backgroundStyles = this.getBackgroundStyles(background);

    // Generate text styles
    const textStyles = `
      .text-container {
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: ${position.y === 'center' ? 'center' : 'flex-start'};
        justify-content: ${position.x === 'center' ? 'center' : 'flex-start'};
        padding: 20px;
      }
      
      .text {
        font-family: "${style.fontFamily}", sans-serif;
        font-size: ${style.fontSize}px;
        color: ${style.color};
        font-weight: ${style.fontWeight || 'normal'};
        text-align: ${style.textAlign || 'left'};
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        max-width: 90%;
      }
      
      ${backgroundStyles}
    `;

    // Generate HTML content
    const content = `
      <div class="scene-background"></div>
      <div class="text-container" style="${position.x !== 'center' ? `padding-left: ${textX}px;` : ''} ${position.y !== 'center' ? `padding-top: ${textY}px;` : ''}">
        <div class="text">${this.escapeHtml(text)}</div>
      </div>
    `;

    const puppeteer = PuppeteerService.getInstance();
    return puppeteer.generateHTML(content, textStyles);
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

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m] || m);
  }
}