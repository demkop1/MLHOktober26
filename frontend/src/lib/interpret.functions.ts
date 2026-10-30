import { createServerFn } from "@tanstack/react-start";

export const interpretReportFn = createServerFn({ method: "POST" })
  .inputValidator((input: { text?: string | undefined; image?: string | undefined }) => {
    if (input.text && input.text.length > 30000) throw new Error("Report is too long.");
    if (input.image && input.image.length > 8_000_000) throw new Error("Image is too large (max ~6MB).");
    return input;
  })
  .handler(async ({ data }) => {
    const { interpretReport } = await import("./interpret.server");
    return interpretReport(data);
  });
