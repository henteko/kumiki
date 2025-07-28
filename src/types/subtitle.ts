export interface SubtitleOptions {
  maxLineLength?: number;
  maxLines?: number;
  minDuration?: number;
}

export interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

export interface SubtitleGeneratorOptions extends SubtitleOptions {
  outputPath?: string;
}