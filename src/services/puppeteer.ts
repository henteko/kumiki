import puppeteer, { Browser, Page } from 'puppeteer';

import { RenderError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

export class PuppeteerService {
  private static instance: PuppeteerService | null = null;
  private browser: Browser | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): PuppeteerService {
    if (!this.instance) {
      this.instance = new PuppeteerService();
    }
    return this.instance;
  }

  /**
   * Launch browser if not already launched
   */
  async launch(): Promise<void> {
    if (this.browser) {
      return;
    }

    logger.debug('Launching Puppeteer browser');

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    } catch (error) {
      throw new RenderError(
        'Failed to launch Puppeteer browser',
        'PUPPETEER_LAUNCH_ERROR',
        { error },
      );
    }
  }

  /**
   * Create a new page
   */
  async createPage(): Promise<Page> {
    if (!this.browser) {
      await this.launch();
    }

    try {
      const page = await this.browser!.newPage();
      return page;
    } catch (error) {
      throw new RenderError(
        'Failed to create new page',
        'PUPPETEER_PAGE_ERROR',
        { error },
      );
    }
  }

  /**
   * Take screenshot of HTML content
   */
  async screenshot(
    html: string,
    options: {
      width: number;
      height: number;
      outputPath: string;
    },
  ): Promise<void> {
    const page = await this.createPage();

    try {
      // Set viewport
      await page.setViewport({
        width: options.width,
        height: options.height,
        deviceScaleFactor: 1,
      });

      // Set content
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      // Take screenshot
      await page.screenshot({
        path: options.outputPath as `${string}.png`,
        type: 'png',
        fullPage: false,
      });

      logger.debug('Screenshot taken', { outputPath: options.outputPath });
    } catch (error) {
      throw new RenderError(
        'Failed to take screenshot',
        'PUPPETEER_SCREENSHOT_ERROR',
        { error, outputPath: options.outputPath },
      );
    } finally {
      await page.close();
    }
  }

  /**
   * Generate HTML from template
   */
  generateHTML(content: string, styles?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    ${styles || ''}
  </style>
</head>
<body>
  ${content}
</body>
</html>
    `.trim();
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      logger.debug('Closing Puppeteer browser');
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Cleanup on process exit
   */
  static async cleanup(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }
}