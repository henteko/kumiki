import type { SubtitleCue } from '@/types/subtitle.js';

export class WebVTTFormatter {
  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    const pad = (n: number, width: number): string => n.toString().padStart(width, '0');

    if (hours > 0) {
      return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(milliseconds, 3)}`;
    }
    return `${pad(minutes, 2)}:${pad(secs, 2)}.${pad(milliseconds, 3)}`;
  }

  formatCue(cue: SubtitleCue): string {
    const startTime = this.formatTime(cue.startTime);
    const endTime = this.formatTime(cue.endTime);
    return `${startTime} --> ${endTime}\n${cue.text}`;
  }

  format(cues: SubtitleCue[]): string {
    const header = 'WEBVTT\n';
    const formattedCues = cues.map(cue => this.formatCue(cue)).join('\n\n');
    return `${header}\n${formattedCues}\n`;
  }
}