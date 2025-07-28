import fs from 'node:fs/promises';
import path from 'node:path';


import { SubtitleTiming } from './timing.js';
import { WebVTTFormatter } from './webvtt.js';

import type { KumikiProject } from '@/types/index.js';
import type { SubtitleOptions, SubtitleCue } from '@/types/subtitle.js';
import { logger } from '@/utils/logger.js';

export class SubtitleGenerator {
  private timing: SubtitleTiming;
  private formatter: WebVTTFormatter;

  constructor() {
    this.timing = new SubtitleTiming();
    this.formatter = new WebVTTFormatter();
  }

  generate(project: KumikiProject, options: SubtitleOptions = {}): string {
    const {
      maxLineLength = 40,
      maxLines = 2,
      minDuration = 1
    } = options;

    logger.info('Generating subtitles', { projectName: project.name });

    const cues: SubtitleCue[] = [];
    const sceneTiming = this.timing.calculateSceneTiming(project.scenes);

    for (const scene of project.scenes) {
      const timing = sceneTiming.get(scene.id);
      if (!timing) continue;

      const cue = this.timing.createCueFromScene(
        scene,
        timing.start,
        timing.end,
        { minDuration }
      );

      if (cue) {
        const processedText = this.timing.splitLongText(cue.text, maxLineLength, maxLines);
        cues.push({
          ...cue,
          text: processedText
        });
      }
    }

    logger.info('Generated subtitle cues', { count: cues.length });
    return this.formatter.format(cues);
  }

  async save(content: string, outputPath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, content, 'utf-8');
      logger.info('Subtitle file saved', { path: outputPath });
    } catch (error) {
      logger.error('Failed to save subtitle file', { error, path: outputPath });
      throw error;
    }
  }

  async generateAndSave(
    project: KumikiProject,
    outputPath: string,
    options: SubtitleOptions = {}
  ): Promise<void> {
    const content = this.generate(project, options);
    await this.save(content, outputPath);
  }
}