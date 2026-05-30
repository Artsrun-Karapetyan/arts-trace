import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiKey: z.string(),
  createdAt: z.string().datetime()
});

export type ProjectDto = z.infer<typeof projectSchema>;
