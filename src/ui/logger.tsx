import { render } from 'ink';
import * as React from 'react';
import winston from 'winston';

import { StatusMessage } from './components.js';

export class InkLogger {
  private static instance: InkLogger | null = null;
  private logger: winston.Logger;
  private isInteractive: boolean;
  private currentRender: { clear: () => void; unmount: () => void; waitUntilExit: () => Promise<void> } | null = null;

  private constructor(logger: winston.Logger) {
    this.logger = logger;
    this.isInteractive = process.stdout.isTTY && !process.env.CI;
  }

  static create(logger: winston.Logger): InkLogger {
    if (!InkLogger.instance) {
      InkLogger.instance = new InkLogger(logger);
    }
    return InkLogger.instance;
  }

  private clearCurrentRender(): void {
    if (this.currentRender) {
      this.currentRender.clear();
      this.currentRender.unmount();
      this.currentRender = null;
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
    
    if (!this.isInteractive) return;
    
    this.clearCurrentRender();
    this.currentRender = render(
      React.createElement(StatusMessage, { type: "info", message, details: meta })
    );
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
    
    if (!this.isInteractive) return;
    
    this.clearCurrentRender();
    this.currentRender = render(
      React.createElement(StatusMessage, { type: "error", message, details: meta })
    );
  }

  success(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
    
    if (!this.isInteractive) return;
    
    this.clearCurrentRender();
    this.currentRender = render(
      React.createElement(StatusMessage, { type: "success", message, details: meta })
    );
  }

  warning(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
    
    if (!this.isInteractive) return;
    
    this.clearCurrentRender();
    this.currentRender = render(
      React.createElement(StatusMessage, { type: "warning", message, details: meta })
    );
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  renderComponent(component: React.ReactElement): void {
    if (!this.isInteractive) return;
    
    this.clearCurrentRender();
    this.currentRender = render(component);
  }

  clear(): void {
    this.clearCurrentRender();
  }

  // Preserve original logger level setting
  set level(level: string) {
    this.logger.level = level;
  }

  get level(): string {
    return this.logger.level;
  }
}