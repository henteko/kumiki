namespace Kumiki;

model KumikiProject {
  version: string;
  name: string;
  settings: ProjectSettings;
  @minItems(1)
  scenes: Scene[];
  audio?: AudioSettings;
}

model ProjectSettings {
  @pattern("^\\d+x\\d+$")
  resolution: string;
  
  @minValue(1)
  @maxValue(120)
  fps: int32;
  
  duration?: int32 | null;
}

union Scene {
  text: TextScene,
  image: ImageScene,
  video: VideoScene,
  composite: CompositeScene,
}

model BaseScene {
  id: string;
  
  @minValue(0.1)
  duration: float64;
  
  background?: Background;
  transition?: Transition;
}

model TextScene extends BaseScene {
  type: "text";
  content: TextContent;
}

model ImageScene extends BaseScene {
  type: "image";
  content: ImageContent;
}

model VideoScene extends BaseScene {
  type: "video";
  content: VideoContent;
}

model CompositeScene extends BaseScene {
  type: "composite";
  layers: Layer[];
}

model TextContent {
  text: string;
  style: TextStyle;
  position: Position;
}

model TextStyle {
  @minValue(1)
  fontSize: int32;
  
  @pattern("^#[0-9A-Fa-f]{6}$")
  color: string;
  
  fontFamily: string;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
}

model ImageContent {
  src: string | GenerateImageSource;
  fit: "cover" | "contain" | "fill";
  position: Position;
}

model GenerateImageSource {
  type: "generate";
  prompt: string;
  style?: "photorealistic" | "illustration" | "anime" | "sketch";
  aspectRatio?: string;
  seed?: int32;
}

model VideoContent {
  src: string;
  trim?: VideoTrim;
}

model VideoTrim {
  @minValue(0)
  start: float64;
  
  @minValue(0)
  end: float64;
}

model Position {
  x: int32 | "center";
  y: int32 | "center";
}

union Layer {
  text: TextLayer,
  image: ImageLayer,
}

model TextLayer {
  type: "text";
  content: TextContent;
  @minValue(0)
  zIndex?: int32;
  opacity?: float64;
}

model ImageLayer {
  type: "image";
  content: ImageContent;
  @minValue(0)
  zIndex?: int32;
  opacity?: float64;
}

model Background {
  type: "color" | "image" | "gradient";
  value: string;
}

model Transition {
  type: "fade" | "wipe" | "dissolve";
  
  @minValue(0.1)
  duration: float64;
  
  direction?: "left" | "right" | "up" | "down";
}

model AudioSettings {
  backgroundMusic?: BackgroundMusic;
  soundEffects?: SoundEffect[];
}

model BackgroundMusic {
  src: string;
  
  @minValue(0)
  @maxValue(1)
  volume: float64;
  
  @minValue(0)
  fadeIn?: float64;
  
  @minValue(0)
  fadeOut?: float64;
}

model SoundEffect {
  src: string;
  
  @minValue(0)
  startTime: float64;
  
  @minValue(0)
  @maxValue(1)
  volume: float64;
}