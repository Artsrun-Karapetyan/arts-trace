import { z } from "zod";

const manualReportAnnotationSchema = z.object({
  kind: z.enum(["highlight", "arrow", "circle", "note"]),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  text: z.string().max(500).optional(),
  color: z.string().max(40).optional()
});

export const manualReportSchema = z.object({
  projectKey: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  screenshotData: z.string().min(8).optional(),
  annotations: z.array(manualReportAnnotationSchema).max(100).optional(),
  url: z.string().url(),
  userAgent: z.string().min(1),
  createdByUserId: z.string().optional()
});

export type ManualReportInput = z.infer<typeof manualReportSchema>;
