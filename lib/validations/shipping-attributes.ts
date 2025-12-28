import { z } from 'zod';

export const LOGISTIC_TYPE_OPTIONS: [
  'drop_off',
  'xd_drop_off',
  'cross_docking',
  'fulfillment',
  'store_pick_up',
  'not_specified',
  'self_service',
] = [
  'drop_off',
  'xd_drop_off',
  'cross_docking',
  'fulfillment',
  'store_pick_up',
  'not_specified',
  'self_service',
];

export const SHIPPING_MODE_OPTIONS: ['me1', 'me2', 'custom', 'not_specified'] = [
  'me1',
  'me2',
  'custom',
  'not_specified',
];

export const FREE_MODE_OPTIONS: ['country', 'region', 'not_specified'] = [
  'country',
  'region',
  'not_specified',
];

const numericStringToNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const shippingAttributesSchema = z
  .object({
    logistic_type: z
      .enum(LOGISTIC_TYPE_OPTIONS as [string, ...string[]])
      .optional(),
    mode: z.enum(SHIPPING_MODE_OPTIONS as [string, ...string[]]).optional(),
    local_pick_up: z.boolean().optional(),
    free_shipping: z.boolean().optional(),
    handling_time: z
      .preprocess((val) => {
        if (val === undefined || val === null || val === '') return undefined;
        return numericStringToNumber(val);
      }, z.number().int().min(0).max(120))
      .optional(),
    dimensions: z
      .string()
      .regex(/^\d+x\d+x\d+,\d+$/, 'Dimensiones deben respetar formato LxWxH,PESO')
      .optional(),
    tags: z.array(z.string()).optional(),
    free_methods: z
      .array(
        z.object({
          id: z.union([z.number(), z.string()]),
          rule: z
            .object({
              free_mode: z.enum(FREE_MODE_OPTIONS).optional(),
              value: z.union([z.string(), z.number(), z.null()]).optional(),
            })
            .partial()
            .optional(),
        }),
      )
      .optional(),
    services: z.array(z.string()).optional(),
    cost: z
      .preprocess((val) => numericStringToNumber(val), z.number().min(0))
      .optional(),
    receiver_address_id: z.string().optional(),
  })
  .partial()
  .passthrough();

export type ShippingAttributesInput = z.infer<typeof shippingAttributesSchema>;

export function normalizeShippingAttributesInput(
  input: unknown,
): { shouldUpdate: boolean; value: Record<string, unknown> | null } {
  if (input === undefined) {
    return {
      shouldUpdate: false,
      value: null,
    };
  }

  if (input === null) {
    return {
      shouldUpdate: true,
      value: null,
    };
  }

  const parsed = shippingAttributesSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Atributos de envío inválidos',
    );
  }

  const sanitizedEntries = Object.entries(parsed.data).filter(
    ([, value]) => value !== undefined,
  );
  const sanitized = Object.fromEntries(sanitizedEntries);

  return {
    shouldUpdate: true,
    value: Object.keys(sanitized).length > 0 ? sanitized : null,
  };
}
