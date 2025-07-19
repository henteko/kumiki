import { z } from 'zod';

const positionSchema = z.union([z.number(), z.literal('center')]);

const textStyleSchema = z.object({
  fontSize: z.number().positive(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontFamily: z.string(),
  fontWeight: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
});

const textContentSchema = z.object({
  text: z.string(),
  style: textStyleSchema,
  position: z.object({
    x: positionSchema,
    y: positionSchema,
  }),
});

const imageContentSchema = z.object({
  src: z.string(),
  fit: z.enum(['cover', 'contain', 'fill']),
  position: z.object({
    x: positionSchema,
    y: positionSchema,
  }),
});

const videoContentSchema = z.object({
  src: z.string(),
  trim: z
    .object({
      start: z.number().nonnegative(),
      end: z.number().positive(),
    })
    .optional(),
});

const backgroundSchema = z.object({
  type: z.enum(['color', 'image', 'gradient']),
  value: z.string(),
});

const animationSchema = z.object({
  type: z.enum(['fade-in', 'fade-out', 'zoom-in', 'zoom-out', 'slide']),
  duration: z.number().positive(),
  easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out']).optional(),
  from: z.number().optional(),
  to: z.number().optional(),
  direction: z.enum(['left', 'right', 'up', 'down']).optional(),
});

const transitionSchema = z.object({
  type: z.enum(['fade', 'wipe', 'dissolve']),
  duration: z.number().positive(),
  direction: z.enum(['left', 'right', 'up', 'down']).optional(),
});

const sceneSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('text'),
    duration: z.number().positive(),
    content: textContentSchema,
    background: backgroundSchema.optional(),
    animation: animationSchema.optional(),
    transition: transitionSchema.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('image'),
    duration: z.number().positive(),
    content: imageContentSchema,
    background: backgroundSchema.optional(),
    animation: animationSchema.optional(),
    transition: transitionSchema.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('video'),
    duration: z.number().positive(),
    content: videoContentSchema,
    background: backgroundSchema.optional(),
    animation: animationSchema.optional(),
    transition: transitionSchema.optional(),
  }),
]);

const backgroundMusicSchema = z.object({
  src: z.string(),
  volume: z.number().min(0).max(1),
  fadeIn: z.number().positive().optional(),
  fadeOut: z.number().positive().optional(),
});

const soundEffectSchema = z.object({
  src: z.string(),
  startTime: z.number().nonnegative(),
  volume: z.number().min(0).max(1),
});

const audioSettingsSchema = z.object({
  backgroundMusic: backgroundMusicSchema.optional(),
  soundEffects: z.array(soundEffectSchema).optional(),
});

export const projectSchema = z.object({
  version: z.string(),
  name: z.string(),
  settings: z.object({
    resolution: z.string().regex(/^\d+x\d+$/),
    fps: z.number().positive().max(120),
    duration: z.number().positive().nullable().optional(),
  }),
  scenes: z.array(sceneSchema).min(1),
  audio: audioSettingsSchema.optional(),
});