import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id.server";
import { interpretationSchema, type Interpretation } from "./report-schema";

const INSTRUCTIONS = `You are a patient-friendly medical explainer. A patient gives you their laboratory report.
Explain it in clear, warm, plain language (reading level ~8th grade). Never diagnose; describe what values typically mean and encourage discussing with their doctor.
- is_lab_report: false if the input is clearly not a medical/lab report (then keep other fields minimal).
- title: short name for the report (e.g. "Complete Blood Count").
- summary: 3-5 sentences overall explanation.
- key_takeaways: 2-5 short bullet points.
- concepts: every test/marker AND notable medical term in the report. Use the exact name as written in the report for "name". plain_name: a friendly everyday name. explanation: what it is (2-3 sentences). why_it_matters: what this specific result may mean (1-2 sentences). status relative to the reference range; use "info" for terms without a value.
- questions_for_doctor: 3-5 helpful questions.
Respond in the same language as the report.`;

export async function interpretReport(input: { text?: string | undefined; image?: string | undefined }): Promise<Interpretation> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("AI is not configured.");

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [];
  if (input.text?.trim()) content.push({ type: "text", text: `Lab report:\n\n${input.text.trim()}` });
  if (input.image) content.push({ type: "image", image: input.image });
  if (!content.length) throw new Error("Please provide a report.");
  if (!input.text?.trim()) content.unshift({ type: "text", text: "Here is a photo of my lab report." });

  const messages: ModelMessage[] = [{ role: "user", content }];

  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions: INSTRUCTIONS,
    messages,
    output: Output.object({ schema: interpretationSchema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  } as Parameters<typeof streamText>[0]);

  try {
    return (await result.output) as Interpretation;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("The AI couldn't read this report. Please try a clearer copy.");
    }
    const status = (error as { statusCode?: number })?.statusCode;
    if (status === 429) throw new Error("Too many requests right now. Please wait a moment and try again.");
    if (status === 402) throw new Error("AI credits are used up. Add credits in Settings → Plans & credits.");
    throw error;
  }
}
