# Kumiki

Kumiki is a CLI tool that automatically generates videos from JSON-based configuration files. You can create videos combining text, images, videos, and composite scenes using simple configuration files.

## Features

- 📝 **JSON-based Configuration**: Define video composition in human-readable JSON format
- 🎬 **Various Scene Types**: Support for text, image, video, and composite scenes
- 🎵 **Audio Support**: BGM, narration, AI music generation
- 🔄 **Scene Transitions**: Fade, wipe, dissolve effects
- 🗣️ **AI Voice Synthesis**: Automatic narration generation via Google Gemini API
- 🎼 **AI Music Generation**: Automatic BGM generation via Google Gemini API
- 🖼️ **AI Image Generation**: Automatic image generation via Google Gemini API
- 🔍 **Schema Validation**: Syntax checking and validation for configuration files
- 💾 **Intelligent Caching**: Automatic caching and reuse of generated content
- 📋 **AI-Assisted Development**: Output JSON Schema for integration with AI tools

## Requirements

- Node.js 18.0.0 or higher
- FFmpeg (must be installed on your system)
- Google Chrome (for preview functionality)
- Google Gemini API key (for AI features)

## Installation

### Install from npm (Recommended)

```bash
npm install -g @henteko/kumiki

# Verify installation
kumiki --version
```

### Build from source

```bash
# Clone the repository
git clone https://github.com/henteko/kumiki.git
cd kumiki

# Install dependencies
npm install

# Build and install globally
npm run build
npm link

kumiki --version
```

### Configuration

Set up your Gemini API key (required for AI features):

```bash
kumiki config set gemini.apiKey YOUR_API_KEY
```

You can also set it via environment variable:

```bash
export GEMINI_API_KEY=YOUR_API_KEY
```

## Usage

### Basic Commands

#### 1. Initialize a New Project

```bash
kumiki init [filename]
```

Generate a sample configuration file.

Options:
- `-f, --force`: Overwrite existing file
- Default filename is `project.json`

#### 2. Validate Project File

```bash
kumiki validate <project.json>
```

Validate the syntax and content of your configuration file.

#### 3. Preview

```bash
kumiki preview <project.json>
```

Display a video preview in your browser (interactive).

#### 4. Generate Video

```bash
kumiki generate <project.json> --output video.mp4
```

Generate a video from the configuration file.

Options:
- `-o, --output <path>`: Output file path (default: output.mp4)
- `-t, --temp-dir <path>`: Temporary files directory
- `-c, --concurrency <number>`: Parallel processing count (default: 2)
- `--keep-temp`: Keep temporary files

#### 5. Show Schema

```bash
kumiki show-schema [--include-examples]
```

Display the JSON Schema for Kumiki projects. Useful for AI tool integration.

#### 6. Configuration Management

```bash
# Set Gemini API key
kumiki config set gemini.apiKey YOUR_API_KEY

# Get a configuration value
kumiki config get gemini.apiKey

# Remove a configuration value
kumiki config unset gemini.apiKey

# List all configuration values
kumiki config list

# Show configuration file path
kumiki config path
```

Manage global configuration settings. Configuration is stored in `~/.kumiki/config.json`.

#### 7. Cache Management

```bash
# Check cache status
kumiki cache status

# Show cache size
kumiki cache size

# Clear cache
kumiki cache clear

# Clear only cache older than 30 days
kumiki cache clear --older-than 30d
```

Manage cached generated images, music, and narrations.

## Project File Structure

### Basic Example

To start a new project, use the `kumiki init` command to generate a sample file:

```bash
kumiki init my-project.json
```

Generated sample file:

```json
{
  "version": "1.0.0",
  "name": "My Awesome Video",
  "settings": {
    "resolution": "1920x1080",
    "fps": 30,
    "narrationDefaults": {
      "voice": {
        "languageCode": "en-US",
        "name": "Journey",
        "speakingRate": 1.0
      },
      "volumeMix": {
        "narration": 0.8,
        "bgm": 0.3
      }
    }
  },
  "audio": {
    "backgroundMusic": {
      "src": "generate://ambient piano music for presentation",
      "volume": 0.7,
      "fadeIn": 2,
      "fadeOut": 3
    }
  },
  "scenes": [
    {
      "id": "intro",
      "type": "text",
      "duration": 5,
      "content": {
        "text": "Hello, Kumiki!",
        "style": {
          "fontSize": 64,
          "color": "#FFFFFF",
          "fontFamily": "Arial",
          "fontWeight": "bold",
          "textAlign": "center"
        },
        "position": {
          "x": "center",
          "y": "center"
        }
      },
      "background": {
        "type": "gradient",
        "value": "linear-gradient(45deg, #FC466B 0%, #3F5EFB 100%)"
      },
      "narration": {
        "text": "Hello, Kumiki!"
      }
    },
    {
      "id": "generate-image",
      "type": "image",
      "duration": 10,
      "content": {
        "src": "generate://A beautiful sunset over the ocean with orange and pink sky",
        "fit": "cover",
        "position": { "x": "center", "y": "center" }
      },
      "narration": {
        "text": "This is a beautiful sunset over the ocean with orange and pink sky generated by Gemini."
      }
    }
  ]
}
```

### Scene Types

#### Text Scene

```json
{
  "id": "text-1",
  "type": "text",
  "duration": 5,
  "content": {
    "text": "Hello World",
    "style": {
      "fontSize": 48,
      "color": "#FFFFFF",
      "fontFamily": "Arial",
      "fontWeight": "bold",
      "textAlign": "center"
    },
    "position": {
      "x": "center",
      "y": "center"
    }
  }
}
```

#### Image Scene

```json
{
  "id": "image-1",
  "type": "image",
  "duration": 3,
  "content": {
    "src": "assets/logo.png",
    "fit": "contain",
    "position": {
      "x": "center",
      "y": "center"
    }
  }
}
```

#### Video Scene

```json
{
  "id": "video-1",
  "type": "video",
  "duration": 10,
  "content": {
    "src": "assets/intro.mp4",
    "trim": {
      "start": 0,
      "end": 10
    }
  }
}
```

#### Composite Scene

```json
{
  "id": "composite-1",
  "type": "composite",
  "duration": 5,
  "layers": [
    {
      "type": "image",
      "content": {
        "src": "assets/background.jpg",
        "fit": "cover",
        "position": { "x": "center", "y": "center" }
      }
    },
    {
      "type": "text",
      "content": {
        "text": "Overlay Text",
        "style": {
          "fontSize": 36,
          "color": "#FFFFFF",
          "fontFamily": "Arial"
        },
        "position": { "x": "center", "y": 100 }
      },
      "opacity": 0.9,
      "zIndex": 1
    }
  ]
}
```

### Background Settings

```json
{
  "background": {
    "type": "color",
    "value": "#1a1a1a"
  }
}

{
  "background": {
    "type": "gradient",
    "value": "linear-gradient(45deg, #667eea 0%, #764ba2 100%)"
  }
}

{
  "background": {
    "type": "image",
    "value": "assets/background.jpg"
  }
}
```

### Transitions

```json
{
  "transition": {
    "type": "fade",
    "duration": 1.0
  }
}

{
  "transition": {
    "type": "wipe",
    "duration": 0.5,
    "direction": "left"
  }
}
```

### Audio Settings

#### BGM (from file)

```json
{
  "audio": {
    "backgroundMusic": {
      "src": "assets/bgm.mp3",
      "volume": 0.5,
      "fadeIn": 2,
      "fadeOut": 2
    }
  }
}
```

#### BGM (AI-generated)

```json
{
  "audio": {
    "backgroundMusic": {
      "src": {
        "type": "generate",
        "prompt": "calm and bright piano and strings BGM",
        "duration": 30,
        "seed": 42
      },
      "volume": 0.5,
      "fadeIn": 2,
      "fadeOut": 2
    }
  }
}
```

### Narration

You can add narration to each scene. Audio is automatically cached to avoid regeneration with the same text and settings.

```json
{
  "narration": {
    "text": "This video introduces new features.",
    "voice": {
      "languageCode": "en-US",
      "name": "Journey",
      "speakingRate": 1.0,
      "pitch": 0,
      "volumeGainDb": 0
    },
    "timing": {
      "delay": 0.5,
      "fadeIn": 0.3,
      "fadeOut": 0.3
    }
  }
}
```

## AI-Assisted Development

### Integration with Claude Code or Gemini CLI

```bash
# Get JSON Schema
kumiki show-schema --include-examples > schema.json

# Pass to AI tools to generate video composition
# Example: "Please create a 30-second product introduction video"
```

### Schema Validation

```bash
# Validation example using ajv
kumiki show-schema > schema.json
ajv validate -s schema.json -d my-project.json
```

## Advanced Usage

### Project Settings

```json
{
  "settings": {
    "resolution": "1920x1080",
    "fps": 30,
    "outputFormat": "mp4",
    "quality": "high",
    "narrationDefaults": {
      "voice": {
        "languageCode": "en-US",
        "name": "Journey",
        "speakingRate": 1.0
      },
      "volumeMix": {
        "narration": 0.8,
        "bgm": 0.3
      }
    },
    "transitionDefaults": {
      "type": "fade",
      "duration": 0.5
    }
  }
}
```

### AI-Generated Content

#### Image Generation

```json
{
  "content": {
    "src": {
      "type": "generate",
      "prompt": "Mount Fuji at sunset",
      "style": "photorealistic",
      "aspectRatio": "16:9"
    }
  }
}
```

#### Music Generation

```json
{
  "audio": {
    "backgroundMusic": {
      "src": {
        "type": "generate",
        "prompt": "energetic rock-style BGM",
        "duration": 60,
        "config": {
          "genre": "rock",
          "tempo": "fast",
          "mood": "energetic"
        }
      }
    }
  }
}
```

### Cache System

Kumiki automatically caches generated content (images, music, narration) to avoid regeneration with the same parameters.

- **Image Cache**: Cache key generated from prompt, style, and aspect ratio
- **Music Cache**: Cache key generated from prompt, duration, and config
- **Narration Cache**: Cache key generated from text and voice settings

Cache is stored in the `.kumiki-cache/` directory.

## Development

### Setup

```bash
# Install dependencies
npm install

# Generate schemas
npm run generate:schema

# Run in development mode
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npm run typecheck
```

### Project Structure

```
kumiki/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── commands/           # CLI commands
│   ├── core/              # Core functionality
│   ├── scenes/            # Scene renderers
│   ├── services/          # External service integrations
│   ├── schemas/           # TypeSpec definitions
│   └── utils/             # Utilities
├── examples/              # Sample projects
└── internal-docs/         # Internal documentation
```

## Troubleshooting

### FFmpeg Not Found

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# Download from FFmpeg official site and add to PATH
```

### Out of Memory Error

For large video processing:

```bash
NODE_OPTIONS="--max-old-space-size=8192" kumiki generate large-project.json
```

### Cache Issues

```bash
# Clear cache
kumiki cache clear

# Check temporary files
kumiki generate project.json --keep-temp
```

## License

Apache License 2.0

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.