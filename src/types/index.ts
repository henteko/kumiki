export interface KumikiProject {
  version: string;
  name: string;
  settings: ProjectSettings;
  scenes: Scene[];
  audio?: AudioSettings;
}

export interface ProjectSettings {
  resolution: string;
  fps: number;
  duration?: number | null;
  narrationDefaults?: NarrationDefaults;
}

export type Scene = TextScene | ImageScene | VideoScene | CompositeScene;

export interface BaseScene {
  id: string;
  duration: number;
  background?: Background;
  transition?: Transition;
  narration?: Narration;
}

export interface TextScene extends BaseScene {
  type: 'text';
  content: TextContent;
}

export interface ImageScene extends BaseScene {
  type: 'image';
  content: ImageContent;
}

export interface VideoScene extends BaseScene {
  type: 'video';
  content: VideoContent;
}

export interface CompositeScene extends BaseScene {
  type: 'composite';
  layers: Layer[];
}

export interface TextContent {
  text: string;
  style: TextStyle;
  position: Position;
}

export interface TextStyle {
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface ImageContent {
  src: string | GenerateImageSource;
  fit: 'cover' | 'contain' | 'fill';
  position: Position;
}

export interface GenerateImageSource {
  type: 'generate';
  prompt: string;
  style?: 'photorealistic' | 'illustration' | 'anime' | 'sketch';
  aspectRatio?: string;
  seed?: number;
}

export interface VideoContent {
  src: string;
  trim?: {
    start: number;
    end: number;
  };
}

export interface Position {
  x: number | 'center';
  y: number | 'center';
}

export type Layer = TextLayer | ImageLayer;

export interface TextLayer {
  type: 'text';
  content: TextContent;
  zIndex?: number;
  opacity?: number;
}

export interface ImageLayer {
  type: 'image';
  content: ImageContent;
  zIndex?: number;
  opacity?: number;
}

export interface Background {
  type: 'color' | 'image' | 'gradient';
  value: string;
}

export interface Transition {
  type: 'fade' | 'wipe' | 'dissolve';
  duration: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface AudioSettings {
  backgroundMusic?: BackgroundMusic;
  soundEffects?: SoundEffect[];
}

export interface BackgroundMusic {
  src: string;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface SoundEffect {
  src: string;
  startTime: number;
  volume: number;
}

export interface SceneRenderOptions {
  tempDir: string;
  resolution: string;
  fps: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface Narration {
  text: string;
  voice?: Voice;
  timing?: NarrationTiming;
}

export interface Voice {
  languageCode: string;
  name: string;
  speakingRate?: number;
  pitch?: number;
  volumeGainDb?: number;
}

export interface NarrationTiming {
  delay?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface NarrationDefaults {
  voice?: Voice;
  volumeMix?: VolumeMix;
}

export interface VolumeMix {
  narration: number;
  bgm: number;
}

export interface ProcessNarrationResult {
  audioPath: string | null;
  duration: number;
}