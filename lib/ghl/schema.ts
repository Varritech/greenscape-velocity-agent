import { z } from "zod";

export const GhlCustomFieldSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const GhlLeadPayloadSchema = z.object({
  contact_id: z.string().min(1),
  location_id: z.string().min(1),
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  source: z.string().min(1),
  message: z.string().optional().default(""),
  custom_fields: z.array(GhlCustomFieldSchema).optional().default([]),
  created_at: z.string().datetime().optional(),
});

export type GhlLeadPayload = z.infer<typeof GhlLeadPayloadSchema>;
