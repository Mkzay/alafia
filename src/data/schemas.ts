import { z } from 'zod';
import { AI_DAILY_BUDGET, EXPORT_FORMAT, EXPORT_FORMAT_VERSION } from './constants';

/** 'YYYY-MM-DD' that is a real calendar date. */
export const localDateSchema = z.string().refine((s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}, 'Must be a real date in YYYY-MM-DD form');

const moveKind = z.enum(['cardio', 'strength', 'mobility', 'sport']);
const intensity = z.enum(['light', 'moderate', 'vigorous']);
const mealSlot = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
const minutesField = z.number().int().min(1).max(300);
const hoursField = z
  .number()
  .min(0)
  .max(14)
  .refine((h) => Number.isInteger(h * 2), 'Hours go up in steps of 0.5');
const qualityField = z.literal([1, 2, 3, 4, 5]);
const checksField = z.strictObject({
  protein: z.boolean(),
  veggies: z.boolean(),
  fiberCarb: z.boolean(),
  water: z.boolean(),
});

const baseFields = {
  id: z.string().min(1),
  loggedAt: z.number().int().positive(),
  localDate: localDateSchema,
  localMinutes: z.number().int().min(0).max(1439),
};

export const moveLogSchema = z.object({
  ...baseFields,
  type: z.literal('move'),
  kind: moveKind,
  minutes: minutesField,
  intensity,
});
export const eatLogSchema = z.object({
  ...baseFields,
  type: z.literal('eat'),
  slot: mealSlot,
  checks: checksField,
  presetId: z.string().min(1).optional(),
});
export const restLogSchema = z.object({
  ...baseFields,
  type: z.literal('rest'),
  hours: hoursField,
  quality: qualityField,
});
export const logSchema = z.discriminatedUnion('type', [moveLogSchema, eatLogSchema, restLogSchema]);

/** Caller-supplied fields only. Strict, so keys such as calories are rejected. */
export const moveInputSchema = z.strictObject({
  type: z.literal('move'),
  kind: moveKind,
  minutes: minutesField,
  intensity,
});
export const eatInputSchema = z.strictObject({
  type: z.literal('eat'),
  slot: mealSlot,
  checks: checksField,
  presetId: z.string().min(1).optional(),
});
export const restInputSchema = z.strictObject({
  type: z.literal('rest'),
  hours: hoursField,
  quality: qualityField,
});
export const newLogInputSchema = z.discriminatedUnion('type', [
  moveInputSchema,
  eatInputSchema,
  restInputSchema,
]);

/** Partial update. `type` is required and must match the stored log. */
export const logPatchSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('move'),
    kind: moveKind.optional(),
    minutes: minutesField.optional(),
    intensity: intensity.optional(),
  }),
  z.strictObject({
    type: z.literal('eat'),
    slot: mealSlot.optional(),
    checks: checksField.optional(),
    presetId: z.string().min(1).optional(),
  }),
  z.strictObject({
    type: z.literal('rest'),
    hours: hoursField.optional(),
    quality: qualityField.optional(),
  }),
]);

export const coachMessageSchema = z.object({
  id: z.string().min(1),
  logId: z.string().min(1),
  text: z.string().min(1).max(240),
  source: z.enum(['template', 'ai']),
  createdAt: z.number().int().positive(),
});
export const newCoachMessageSchema = z.strictObject({
  logId: z.string().min(1),
  text: z.string().min(1).max(240),
  source: z.enum(['template', 'ai']),
});

export const aiBudgetSchema = z.object({
  date: localDateSchema,
  used: z.number().int().min(0).max(AI_DAILY_BUDGET),
});

export const settingSchemas = {
  aiEnabled: z.boolean(),
  aiBudget: aiBudgetSchema,
  firstRunAcknowledged: z.boolean(),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

export const settingsSchema = z.object({
  aiEnabled: settingSchemas.aiEnabled,
  aiBudget: settingSchemas.aiBudget,
  firstRunAcknowledged: settingSchemas.firstRunAcknowledged,
});

export function settingDefaults(today: string): Settings {
  return {
    aiEnabled: true,
    aiBudget: { date: today, used: 0 },
    firstRunAcknowledged: false,
  };
}

export const exportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_FORMAT_VERSION),
  exportedAt: z.number().int().positive(),
  logs: z.array(logSchema),
  coachMessages: z.array(coachMessageSchema),
  settings: settingsSchema,
});

export type StoredLog = z.infer<typeof logSchema>;
export type NewLogInput = z.infer<typeof newLogInputSchema>;
export type LogPatch = z.infer<typeof logPatchSchema>;
export type CoachMessage = z.infer<typeof coachMessageSchema>;
export type NewCoachMessage = z.infer<typeof newCoachMessageSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type SettingValue<K extends SettingKey> = Settings[K];
export type ExportDocument = z.infer<typeof exportSchema>;
