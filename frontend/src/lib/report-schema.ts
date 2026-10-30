import { z } from "zod";

export const conceptSchema = z.object({
  name: z.string(),
  value: z.string().nullable(),
  unit: z.string().nullable(),
  reference_range: z.string().nullable(),
  status: z.enum(["low", "normal", "high", "abnormal", "info"]),
  plain_name: z.string(),
  explanation: z.string(),
  why_it_matters: z.string(),
});

export const interpretationSchema = z.object({
  is_lab_report: z.boolean(),
  title: z.string(),
  overall_status: z.enum(["reassuring", "some_attention", "needs_attention"]),
  summary: z.string(),
  key_takeaways: z.array(z.string()),
  concepts: z.array(conceptSchema),
  questions_for_doctor: z.array(z.string()),
});

export type Concept = z.infer<typeof conceptSchema>;
export type Interpretation = z.infer<typeof interpretationSchema>;
