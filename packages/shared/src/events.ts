import { z } from "zod";

export const breadcrumbSchema = z.object({
  type: z.string().min(1),
  message: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime()
});

export const networkRequestSchema = z.object({
  method: z.string().min(1),
  url: z.string().min(1),
  status: z.number().int().optional(),
  requestHeaders: z.record(z.string(), z.string()).optional(),
  requestBody: z.string().optional(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
  responseBody: z.string().optional(),
  error: z.string().optional(),
  duration: z.number().int().optional(),
  createdAt: z.string().datetime()
});

export const ingestEventSchema = z.object({
  apiKey: z.string().min(1),
  release: z.string().min(1).max(200).optional(),
  message: z.string().min(1),
  stack: z.string().optional(),
  filePath: z.string().optional(),
  fileName: z.string().optional(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  url: z.string().url(),
  userAgent: z.string().min(1),
  timestamp: z.string().datetime(),
  userId: z.string().optional(),
  breadcrumbs: z.array(breadcrumbSchema).max(100).optional(),
  networkRequests: z.array(networkRequestSchema).max(100).optional(),
  replayEvents: z.array(z.record(z.string(), z.unknown())).max(5000).optional()
});

export type IngestEventInput = z.infer<typeof ingestEventSchema>;

export const uploadSourceMapSchema = z.object({
  apiKey: z.string().min(1),
  release: z.string().min(1).max(200),
  fileName: z.string().min(1).max(500),
  content: z.string().min(2)
});

export type UploadSourceMapInput = z.infer<typeof uploadSourceMapSchema>;

export const uploadReplaySchema = z.object({
  apiKey: z.string().min(1),
  replayEvents: z.array(z.record(z.string(), z.unknown())).min(2).max(5000)
});

export type UploadReplayInput = z.infer<typeof uploadReplaySchema>;

export const successResponseSchema = z.object({
  success: z.literal(true)
});

export type SuccessResponse = z.infer<typeof successResponseSchema>;
