import type { Scene } from '@/types/index.js';
import type { SubtitleCue } from '@/types/subtitle.js';

export class SubtitleTiming {
  calculateSceneTiming(scenes: Scene[]): Map<string, { start: number; end: number }> {
    const timingMap = new Map<string, { start: number; end: number }>();
    let currentTime = 0;

    for (const scene of scenes) {
      const startTime = currentTime;
      const endTime = currentTime + scene.duration;

      timingMap.set(scene.id, { start: startTime, end: endTime });
      currentTime = endTime;
    }

    return timingMap;
  }

  createCueFromScene(
    scene: Scene,
    startTime: number,
    endTime: number,
    options: { minDuration?: number } = {}
  ): SubtitleCue | null {
    const text = this.extractTextFromScene(scene);
    if (!text) return null;

    const minDuration = options.minDuration ?? 1;
    const duration = endTime - startTime;
    
    if (duration < minDuration) {
      endTime = startTime + minDuration;
    }

    return {
      startTime,
      endTime,
      text
    };
  }

  private extractTextFromScene(scene: Scene): string | null {
    if (scene.narration?.text) {
      return scene.narration.text;
    }

    switch (scene.type) {
      case 'text':
        return scene.content.text;
      case 'composite': {
        const textLayers = scene.layers.filter(layer => layer.type === 'text');
        if (textLayers.length > 0) {
          return textLayers.map(layer => layer.type === 'text' ? layer.content.text : '').join(' ');
        }
        break;
      }
    }

    return null;
  }

  splitLongText(text: string, maxLineLength: number, maxLines: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= maxLineLength) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word.substring(0, maxLineLength));
          currentLine = word.substring(maxLineLength);
        }
      }

      // If we've reached the maximum number of lines and need to add the last line
      if (lines.length >= maxLines - 1 && currentLine) {
        // Add all remaining words to the current line
        const remainingWords = words.slice(words.indexOf(word) + 1);
        if (remainingWords.length > 0) {
          currentLine = [currentLine, ...remainingWords].join(' ');
        }
        lines.push(currentLine);
        break;
      }
    }

    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    return lines.slice(0, maxLines).join('\n');
  }
}