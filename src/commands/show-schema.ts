import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';
import * as yaml from 'js-yaml';

import { logger } from '@/utils/logger.js';

interface ShowSchemaOptions {
  includeExamples?: boolean;
}

interface JsonSchemaDefinition {
  type?: string | string[];
  properties?: Record<string, JsonSchemaDefinition>;
  items?: JsonSchemaDefinition;
  $ref?: string;
  required?: string[];
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  enum?: unknown[];
  anyOf?: JsonSchemaDefinition[];
  allOf?: JsonSchemaDefinition[];
  oneOf?: JsonSchemaDefinition[];
  description?: string;
  examples?: unknown[];
  [key: string]: unknown;
}

interface JsonSchema {
  $schema?: string;
  $id?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchemaDefinition>;
  required?: string[];
  $defs?: Record<string, JsonSchemaDefinition>;
  examples?: unknown[];
  [key: string]: unknown;
}

export const showSchemaCommand = new Command('show-schema')
  .description('Show the JSON Schema for Kumiki project files')
  .option('--include-examples', 'include example values for each field')
  .action((options: ShowSchemaOptions) => {
    try {
      // Get the directory of this file
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      
      // Path to generated JSON Schema files - go up from commands to src, then into schemas
      const schemaDir = path.join(__dirname, '..', '..', 'src', 'schemas', 'generated', '@typespec', 'json-schema');
      
      // Read all YAML schema files
      const schemaFiles = readdirSync(schemaDir).filter(file => file.endsWith('.yaml'));
      
      // Load all schemas into a definitions object
      const definitions: Record<string, JsonSchemaDefinition> = {};
      
      for (const file of schemaFiles) {
        const schemaName = path.basename(file, '.yaml');
        const schemaPath = path.join(schemaDir, file);
        const schemaContent = readFileSync(schemaPath, 'utf-8');
        const schema = yaml.load(schemaContent) as JsonSchemaDefinition;
        
        // Convert relative $refs to definition references
        const processedSchema = processRefs(schema);
        definitions[schemaName] = processedSchema;
      }
      
      // Get the main KumikiProject schema
      const kumikiProjectSchema = definitions.KumikiProject;
      if (!kumikiProjectSchema) {
        throw new Error('KumikiProject schema not found');
      }
      
      // Create the main JSON Schema with KumikiProject as root
      const mainSchema: JsonSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'KumikiProject',
        description: 'Schema for Kumiki video generation project files',
        ...processRefs(kumikiProjectSchema),
        $defs: { ...definitions }
      };
      
      // Remove KumikiProject from definitions since it's the root
      if (mainSchema.$defs) {
        delete mainSchema.$defs.KumikiProject;
      }
      
      // Add duration descriptions
      const schemaWithDescriptions = addDurationDescriptions(mainSchema);
      
      // Add examples if requested
      let finalSchema = schemaWithDescriptions;
      if (options.includeExamples) {
        finalSchema = addExamples(schemaWithDescriptions);
      }
      
      // Output JSON Schema to stdout
      console.log(JSON.stringify(finalSchema, null, 2));
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error generating schema: ${error.message}`);
      } else {
        logger.error('An unknown error occurred');
      }
      process.exit(1);
    }
  });

/**
 * Add description to duration fields
 */
function addDurationDescriptions<T>(schema: T): T {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }
  
  if (Array.isArray(schema)) {
    return schema.map((item: unknown) => addDurationDescriptions(item)) as T;
  }
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'properties' && typeof value === 'object' && value !== null) {
      // Process properties object
      const props: Record<string, unknown> = {};
      for (const [propKey, propValue] of Object.entries(value as Record<string, unknown>)) {
        if (propKey === 'duration' && typeof propValue === 'object' && propValue !== null) {
          // Add description to duration field
          props[propKey] = {
            ...propValue,
            description: 'Duration in seconds'
          };
        } else {
          props[propKey] = addDurationDescriptions(propValue);
        }
      }
      result[key] = props;
    } else {
      result[key] = addDurationDescriptions(value);
    }
  }
  
  return result as T;
}

/**
 * Process $refs to convert file references to definition references
 */
function processRefs<T>(schema: T): T {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }
  
  if (Array.isArray(schema)) {
    return schema.map(processRefs) as T;
  }
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(schema)) {
    // Skip $schema and $id in definitions as they are not needed
    if (key === '$schema' || key === '$id') {
      continue;
    }
    
    if (key === '$ref' && typeof value === 'string' && value.endsWith('.yaml')) {
      // Convert file reference to definition reference
      result[key] = `#/$defs/${value.replace('.yaml', '')}`;
    } else {
      result[key] = processRefs(value);
    }
  }
  
  return result as T;
}

/**
 * Add example values to the JSON Schema
 */
function addExamples(schema: JsonSchema): JsonSchema {
  const schemaWithExamples = JSON.parse(JSON.stringify(schema)) as JsonSchema;
  
  // Add top-level example
  schemaWithExamples.examples = [
    {
      version: '1.0.0',
      name: 'Sample Video Project',
      settings: {
        resolution: '1920x1080',
        fps: 30,
        narrationDefaults: {
          voice: {
            languageCode: 'ja-JP',
            name: 'Kore',
            speakingRate: 1.0
          }
        }
      },
      scenes: [
        {
          id: 'intro',
          type: 'text',
          duration: 5,
          content: {
            text: 'Welcome to Kumiki',
            style: {
              fontSize: 48,
              color: '#FFFFFF',
              fontFamily: 'Arial',
            },
            position: {
              x: 'center',
              y: 'center',
            },
          },
          background: {
            type: 'gradient',
            value: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)'
          }
        },
      ],
      audio: {
        backgroundMusic: {
          src: 'assets/background-music.mp3',
          volume: 0.5,
          fadeIn: 2,
          fadeOut: 2
        }
      }
    },
  ];
  
  // Add examples to specific definitions
  if (schemaWithExamples.$defs) {
    // Project settings examples
    const projectSettings = schemaWithExamples.$defs.ProjectSettings;
    if (projectSettings) {
      projectSettings.examples = [
        {
          resolution: '1920x1080',
          fps: 30
        },
        {
          resolution: '1280x720',
          fps: 24,
          narrationDefaults: {
            voice: {
              languageCode: 'en-US',
              name: 'en-US-Neural2-A'
            }
          }
        }
      ];
    }
    
    // Scene examples
    const textScene = schemaWithExamples.$defs.TextScene;
    if (textScene) {
      textScene.examples = [
        {
          id: 'text-1',
          type: 'text',
          duration: 5,
          content: {
            text: 'Hello World',
            style: {
              fontSize: 48,
              color: '#FFFFFF',
              fontFamily: 'Arial',
            },
            position: {
              x: 'center',
              y: 'center',
            },
          },
        },
      ];
    }
    
    const imageScene = schemaWithExamples.$defs.ImageScene;
    if (imageScene) {
      imageScene.examples = [
        {
          id: 'image-1',
          type: 'image',
          duration: 3,
          content: {
            src: 'assets/logo.png',
            fit: 'contain',
            position: {
              x: 'center',
              y: 'center',
            },
          },
        },
      ];
    }
    
    const narration = schemaWithExamples.$defs.Narration;
    if (narration) {
      narration.examples = [
        {
          text: 'Welcome to our presentation.',
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-A',
            speakingRate: 1.0,
          },
        },
        {
          text: 'こんにちは、Kumikiへようこそ。',
          voice: {
            languageCode: 'ja-JP',
            name: 'Kore',
            speakingRate: 0.9,
            pitch: -2,
          },
          timing: {
            delay: 0.5,
            fadeIn: 0.3,
            fadeOut: 0.3,
          },
        },
      ];
    }
    
    const transition = schemaWithExamples.$defs.Transition;
    if (transition) {
      transition.examples = [
        {
          type: 'fade',
          duration: 1.0,
        },
        {
          type: 'wipe',
          duration: 0.5,
          direction: 'left',
        },
      ];
    }
    
    const backgroundMusic = schemaWithExamples.$defs.BackgroundMusic;
    if (backgroundMusic) {
      backgroundMusic.examples = [
        {
          src: 'assets/background-music.mp3',
          volume: 0.5,
          fadeIn: 2,
          fadeOut: 2,
        },
      ];
    }
  }
  
  return schemaWithExamples;
}