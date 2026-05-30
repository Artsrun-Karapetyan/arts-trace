import { z } from "zod";

export const ingestEventSchema = z.object({
  apiKey: z.string().min(1),
  message: z.string().min(1),
  stack: z.string().optional(),
  url: z.string().url(),
  userAgent: z.string().min(1),
  timestamp: z.string().datetime()
});

export type IngestEventInput = z.infer<typeof ingestEventSchema>;

export const successResponseSchema = z.object({
  success: z.literal(true)
});

export type SuccessResponse = z.infer<typeof successResponseSchema>;
