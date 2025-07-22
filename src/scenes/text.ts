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
      hasNarration: !!this.narrationPath,
    });

    // First render static image
    const imagePath = await this.renderStatic();
    
    // Convert image to video using FFmpeg
    let videoPath = this.getVideoOutputPath();
    const ffmpeg = FFmpegService.getInstance();
    
    await ffmpeg.imageToVideo({
      input: imagePath,
      output: videoPath,
      duration: this.scene.duration,
      fps: this.options.fps,
      resolution: this.options.resolution,
    });

    // Add narration if available
    if (this.narrationPath && this.scene.narration) {
      const narrationVideoPath = videoPath.replace('.mp4', '_narrated.mp4');
      
      await ffmpeg.addNarrationTrack(
        videoPath,
        this.narrationPath,
        narrationVideoPath,
        {
          narrationVolume: this.scene.narration.voice?.volumeGainDb 
            ? Math.pow(10, this.scene.narration.voice.volumeGainDb / 20)
            : 0.8,
          delay: this.scene.narration.timing?.delay || 0,
          fadeIn: this.scene.narration.timing?.fadeIn || 0,
          fadeOut: this.scene.narration.timing?.fadeOut || 0,
        }
      );
      
      videoPath = narrationVideoPath;
    }

    logger.info('Text scene rendered to video', {
      sceneId: this.scene.id,
      outputPath: videoPath,
    });

    return videoPath;
  }

  /**
   * Generate text element HTML (for reuse in CompositeSceneRenderer)
   */
  static generateTextElement(
    text: string,
    style: TextScene['content']['style'],
    position: TextScene['content']['position'],
    width: number,
    height: number
  ): string {
    // Calculate text position
    const textX = TextSceneRenderer.calculatePositionStatic(position.x, width, 0);
    const textY = TextSceneRenderer.calculatePositionStatic(position.y, height, 0);

    const positionStyles = [];
    if (position.x === 'center') {
      positionStyles.push('left: 50%', 'transform: translateX(-50%)');
    } else {
      positionStyles.push(`left: ${textX}px`);
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
      positionStyles.push(`top: ${textY}px`);
    }

    const textStyleParts = [
      'position: absolute',
      ...positionStyles,
      `font-family: '${style.fontFamily}', sans-serif`,
      `font-size: ${style.fontSize}px`,
      `color: ${style.color}`,
      `font-weight: ${style.fontWeight || 'normal'}`,
      `text-align: ${style.textAlign || 'left'}`,
      'line-height: 1.5',
      'white-space: pre-wrap',
      'word-wrap: break-word',
      'max-width: 90%'
    ];

    const textStyles = textStyleParts.join('; ');

    return `<div style="${textStyles}">${TextSceneRenderer.escapeHtmlStatic(text)}</div>`;
  }

  /**
   * Calculate position value (static version for reuse)
   */
  private static calculatePositionStatic(value: number | 'center', dimension: number, padding: number): number {
    if (value === 'center') {
      return dimension / 2;
    }
    return value + padding;
  }

  /**
   * Escape HTML special characters (static version for reuse)
   */
  static escapeHtmlStatic(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text
      .replace(/[&<>"']/g, (m) => map[m] || m)
      .replace(/\n/g, '<br>');
  }

  /**
   * Generate HTML for text scene
   */
  private generateHTML(width: number, height: number): string {
    const { text, style, position } = this.scene.content;
    const background = this.scene.background;

    // Generate background styles
    const backgroundStyles = this.getBackgroundStyles(background);

    // Generate styles
    const styles = `
      ${backgroundStyles}
    `;

    // Generate HTML content using the static method
    const textElement = TextSceneRenderer.generateTextElement(text, style, position, width, height);
    const content = `
      <div class="scene-background"></div>
      ${textElement}
    `;

    const puppeteer = PuppeteerService.getInstance();
    return puppeteer.generateHTML(content, styles);
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