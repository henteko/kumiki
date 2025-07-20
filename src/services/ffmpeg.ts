import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ProcessError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';


export interface FFmpegOptions {
  input: string;
  output: string;
  additionalArgs?: string[];
  onProgress?: (progress: number) => void;
}

export interface ConcatOptions {
  inputs: string[];
  output: string;
  onProgress?: (progress: number) => void;
}

export interface ImageToVideoOptions {
  input: string;
  output: string;
  duration: number;
  fps: number;
  resolution: string;
  onProgress?: (progress: number) => void;
}

export interface VideoTrimOptions {
  input: string;
  output: string;
  start: number;
  duration: number;
  resolution?: string;
  onProgress?: (progress: number) => void;
}

export class FFmpegService {
  private static instance: FFmpegService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): FFmpegService {
    if (!FFmpegService.instance) {
      FFmpegService.instance = new FFmpegService();
    }
    return FFmpegService.instance;
  }

  /**
   * Check if FFmpeg is installed
   */
  async checkInstallation(): Promise<boolean> {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      
      ffmpeg.on('error', () => {
        logger.error('FFmpeg not found. Please install FFmpeg.');
        resolve(false);
      });
      
      ffmpeg.on('close', (code) => {
        resolve(code === 0);
      });
    });
  }

  /**
   * Convert image to video
   */
  async imageToVideo(options: ImageToVideoOptions): Promise<void> {
    const { input, output, duration, fps, resolution } = options;
    
    if (!existsSync(input)) {
      throw new ProcessError(
        `Input file not found: ${input}`,
        'INPUT_NOT_FOUND',
      );
    }

    await this.ensureOutputDirectory(output);

    const args = [
      '-loop', '1',
      '-i', input,
      '-c:v', 'libx264',
      '-t', duration.toString(),
      '-r', fps.toString(),
      '-s', resolution,
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-y',
      output,
    ];

    logger.info('Converting image to video', { input, output, duration });

    await this.execute('ffmpeg', args, options.onProgress);
  }

  /**
   * Trim video
   */
  async trimVideo(options: VideoTrimOptions): Promise<void> {
    const { input, output, start, duration, resolution } = options;
    
    if (!existsSync(input)) {
      throw new ProcessError(
        `Input file not found: ${input}`,
        'INPUT_NOT_FOUND',
      );
    }

    await this.ensureOutputDirectory(output);

    const args = [
      '-ss', start.toString(),
      '-i', input,
      '-t', duration.toString(),
      '-c:v', 'libx264',
      '-preset', 'fast',
    ];

    // Add scaling if resolution is specified
    if (resolution) {
      const [width, height] = resolution.split('x');
      args.push(
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
      );
    }

    args.push(
      '-c:a', 'aac',
      '-y',
      output,
    );

    logger.info('Trimming video', { input, output, start, duration, resolution });

    await this.execute('ffmpeg', args, options.onProgress);
  }

  /**
   * Concatenate videos
   */
  async concatenate(options: ConcatOptions): Promise<void> {
    const { inputs, output } = options;
    
    // Check all input files exist
    for (const input of inputs) {
      if (!existsSync(input)) {
        throw new ProcessError(
          `Input file not found: ${input}`,
          'INPUT_NOT_FOUND',
        );
      }
    }

    await this.ensureOutputDirectory(output);

    // Create temporary concat list file
    const concatListPath = path.join(path.dirname(output), 'concat-list.txt');
    const concatList = inputs.map(input => `file '${path.resolve(input)}'`).join('\n');
    await writeFile(concatListPath, concatList);
    
    try {
      // Use concat demuxer
      const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        '-y',
        output,
      ];

      logger.info('Concatenating videos', { count: inputs.length, output });

      await this.execute('ffmpeg', args, options.onProgress);
    } finally {
      // Clean up temp file
      if (existsSync(concatListPath)) {
        await unlink(concatListPath);
      }
    }
  }

  /**
   * Apply fade transition between two videos
   */
  async fadeTransition(video1: string, video2: string, output: string, duration: number): Promise<void> {
    if (!existsSync(video1) || !existsSync(video2)) {
      throw new ProcessError(
        'Input video files not found',
        'INPUT_NOT_FOUND',
      );
    }

    await this.ensureOutputDirectory(output);

    // Get duration of first video to calculate offset
    const video1Duration = await this.getVideoDuration(video1);
    const offset = Math.max(0, video1Duration - duration);

    // Check if videos have audio streams
    const hasAudio = await this.hasAudioStream(video1) && await this.hasAudioStream(video2);

    // Create complex filter for fade transition
    let filter: string;
    let args: string[];
    
    if (hasAudio) {
      filter = `[0:v][1:v]xfade=transition=fade:duration=${duration}:offset=${offset}[v];[0:a][1:a]acrossfade=d=${duration}:c1=tri:c2=tri[a]`;
      args = [
        '-i', video1,
        '-i', video2,
        '-filter_complex', filter,
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-y',
        output,
      ];
    } else {
      filter = `[0:v][1:v]xfade=transition=fade:duration=${duration}:offset=${offset}[v]`;
      args = [
        '-i', video1,
        '-i', video2,
        '-filter_complex', filter,
        '-map', '[v]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-y',
        output,
      ];
    }

    logger.info('Applying fade transition', { video1, video2, duration, offset });

    await this.execute('ffmpeg', args);
  }

  /**
   * Apply wipe transition between two videos
   */
  async wipeTransition(
    video1: string, 
    video2: string, 
    output: string, 
    duration: number,
    direction: 'left' | 'right' | 'up' | 'down' = 'left'
  ): Promise<void> {
    if (!existsSync(video1) || !existsSync(video2)) {
      throw new ProcessError(
        'Input video files not found',
        'INPUT_NOT_FOUND',
      );
    }

    await this.ensureOutputDirectory(output);

    // Get duration of first video to calculate offset
    const video1Duration = await this.getVideoDuration(video1);
    const offset = Math.max(0, video1Duration - duration);

    // Check if videos have audio streams
    const hasAudio = await this.hasAudioStream(video1) && await this.hasAudioStream(video2);

    // Map direction to xfade transition names
    const transitionMap = {
      left: 'wipeleft',
      right: 'wiperight',
      up: 'wipeup',
      down: 'wipedown',
    };

    let filter: string;
    let args: string[];
    
    if (hasAudio) {
      filter = `[0:v][1:v]xfade=transition=${transitionMap[direction]}:duration=${duration}:offset=${offset}[v];[0:a][1:a]acrossfade=d=${duration}:c1=tri:c2=tri[a]`;
      args = [
        '-i', video1,
        '-i', video2,
        '-filter_complex', filter,
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-y',
        output,
      ];
    } else {
      filter = `[0:v][1:v]xfade=transition=${transitionMap[direction]}:duration=${duration}:offset=${offset}[v]`;
      args = [
        '-i', video1,
        '-i', video2,
        '-filter_complex', filter,
        '-map', '[v]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-y',
        output,
      ];
    }

    logger.info('Applying wipe transition', { video1, video2, duration, direction, offset });

    await this.execute('ffmpeg', args);
  }

  /**
   * Apply dissolve transition between two videos
   */
  async dissolveTransition(video1: string, video2: string, output: string, duration: number): Promise<void> {
    if (!existsSync(video1) || !existsSync(video2)) {
      throw new ProcessError(
        'Input video files not found',
        'INPUT_NOT_FOUND',
      );
    }

    await this.ensureOutputDirectory(output);

    // Get duration of first video to calculate offset
    const video1Duration = await this.getVideoDuration(video1);
    const offset = Math.max(0, video1Duration - duration);

    // Check if videos have audio streams
    const hasAudio = await this.hasAudioStream(video1) && await this.hasAudioStream(video2);

    let filter: string;
    let args: string[];
    
    if (hasAudio) {
      filter = `[0:v][1:v]xfade=transition=dissolve:duration=${duration}:offset=${offset}[v];[0:a][1:a]acrossfade=d=${duration}:c1=tri:c2=tri[a]`;
      args = [
        '-i', video1,
        '-i', video2,
        '-filter_complex', filter,
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-y',
        output,
      ];
    } else {
      filter = `[0:v][1:v]xfade=transition=dissolve:duration=${duration}:offset=${offset}[v]`;
      args = [
        '-i', video1,
        '-i', video2,
        '-filter_complex', filter,
        '-map', '[v]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-y',
        output,
      ];
    }

    logger.info('Applying dissolve transition', { video1, video2, duration, offset });

    await this.execute('ffmpeg', args);
  }

  /**
   * Add audio to video
   */
  async addAudio(videoPath: string, audioPath: string, outputPath: string, volume = 1.0): Promise<void> {
    if (!existsSync(videoPath)) {
      throw new ProcessError(
        `Video file not found: ${videoPath}`,
        'VIDEO_NOT_FOUND',
      );
    }

    if (!existsSync(audioPath)) {
      throw new ProcessError(
        `Audio file not found: ${audioPath}`,
        'AUDIO_NOT_FOUND',
      );
    }

    await this.ensureOutputDirectory(outputPath);

    const args = [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-filter:a', `volume=${volume}`,
      '-shortest',
      '-y',
      outputPath,
    ];

    logger.info('Adding audio to video', { video: videoPath, audio: audioPath });

    await this.execute('ffmpeg', args);
  }

  /**
   * Add audio to video with fade in/out effects
   */
  async addAudioWithFade(
    videoPath: string, 
    audioPath: string, 
    outputPath: string, 
    volume = 1.0,
    fadeIn?: number,
    fadeOut?: number
  ): Promise<void> {
    if (!existsSync(videoPath)) {
      throw new ProcessError(
        `Video file not found: ${videoPath}`,
        'VIDEO_NOT_FOUND',
      );
    }

    if (!existsSync(audioPath)) {
      throw new ProcessError(
        `Audio file not found: ${audioPath}`,
        'AUDIO_NOT_FOUND',
      );
    }

    await this.ensureOutputDirectory(outputPath);

    // Get video duration to calculate fade out timing
    const videoDuration = await this.getVideoDuration(videoPath);
    
    // Build audio filter chain
    let audioFilter = `volume=${volume}`;
    
    if (fadeIn && fadeIn > 0) {
      audioFilter = `afade=t=in:st=0:d=${fadeIn},${audioFilter}`;
    }
    
    if (fadeOut && fadeOut > 0) {
      const fadeOutStart = Math.max(0, videoDuration - fadeOut);
      audioFilter = `${audioFilter},afade=t=out:st=${fadeOutStart}:d=${fadeOut}`;
    }

    const args = [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-filter:a', audioFilter,
      '-shortest',
      '-y',
      outputPath,
    ];

    logger.info('Adding audio with fade effects', { 
      video: videoPath, 
      audio: audioPath,
      fadeIn,
      fadeOut,
      volume,
      videoDuration
    });

    await this.execute('ffmpeg', args);
  }

  /**
   * Execute FFmpeg command
   */
  execute(
    command: string,
    args: string[],
    onProgress?: (progress: number) => void,
    stdin?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug('Executing FFmpeg command', { command, args });

      const proc = spawn(command, args);
      let stderr = '';
      let duration = 0;

      if (stdin) {
        proc.stdin.write(stdin);
        proc.stdin.end();
      }

      proc.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;

        // Parse duration from stderr
        if (duration === 0) {
          const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
          if (durationMatch && durationMatch[1] && durationMatch[2] && durationMatch[3]) {
            const [, hours, minutes, seconds] = durationMatch;
            duration = parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
          }
        }

        // Parse progress
        if (onProgress && duration > 0) {
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
          if (timeMatch && timeMatch[1] && timeMatch[2] && timeMatch[3]) {
            const [, hours, minutes, seconds] = timeMatch;
            const current = parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
            const progress = Math.min((current / duration) * 100, 100);
            onProgress(progress);
          }
        }
      });

      proc.on('error', (error) => {
        reject(new ProcessError(
          `Failed to execute ${command}: ${error.message}`,
          'FFMPEG_EXECUTION_ERROR',
        ));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new ProcessError(
            `FFmpeg process exited with code ${code}`,
            'FFMPEG_ERROR',
            { stderr },
          ));
        }
      });
    });
  }

  /**
   * Check if video has audio stream
   */
  private async hasAudioStream(videoPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const args = [
        '-i', videoPath,
        '-show_streams',
        '-select_streams', 'a',
        '-v', 'quiet',
        '-of', 'json',
      ];

      const proc = spawn('ffprobe', args);
      let stdout = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.on('error', (error) => {
        // If ffprobe fails, assume no audio
        logger.warn('Failed to check audio stream', { error: error.message });
        resolve(false);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout) as { streams?: unknown[] };
            const hasAudio = Boolean(result.streams && result.streams.length > 0);
            resolve(hasAudio);
          } catch {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });
  }

  /**
   * Get video duration in seconds
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-show_entries', 'format=duration',
        '-v', 'quiet',
        '-of', 'csv=p=0',
      ];

      const proc = spawn('ffprobe', args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        reject(new ProcessError(
          `Failed to get video duration: ${error.message}`,
          'FFPROBE_ERROR',
        ));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(stdout.trim());
          if (isNaN(duration)) {
            reject(new ProcessError(
              'Failed to parse video duration',
              'DURATION_PARSE_ERROR',
              { stdout, stderr },
            ));
          } else {
            resolve(duration);
          }
        } else {
          reject(new ProcessError(
            `ffprobe process exited with code ${code}`,
            'FFPROBE_ERROR',
            { stderr },
          ));
        }
      });
    });
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}