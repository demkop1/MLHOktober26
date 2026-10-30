import type { ExtractedLine } from "./types";

/** Entirely synthetic report used for demos and tests. Not a real person. */
export const SAMPLE_TEXT = `Sample Diagnostics Lab
Patient: Jane Example (synthetic)
Collected date: 2026-03-14
Test Result Units Reference Range
Hemoglobin 11.2 L g/dL 12.0 - 15.5
White Blood Cells 6.4 10^3/uL 4.0 - 11.0
Platelets 412 H 10^3/uL 150 - 400
Glucose, fasting 92 mg/dL 70 - 99
HbA1c 5.4 % < 5.7
LDL Cholesterol 142 mg/dL < 130 H
HDL Cholesterol 58 mg/dL > 40
Creatinine 0.9 mg/dL
TSH 2.1 mIU/L 0.4 - 4.0
CRP < 0.5 mg/L < 5.0
Vitamin D 18 ng/mL 30 - 100 L
Hepatitis B surface antigen Negative`;

export const sampleLines = (): ExtractedLine[] =>
  SAMPLE_TEXT.split("\n").map((text) => ({ text, page: 1, confidence: null }));

/** Same synthetic patient, 6 months earlier — lets trend charts and comparisons show. */
export const SAMPLE_BASELINE_TEXT = `Sample Diagnostics Lab
Patient: Jane Example (synthetic)
Collected date: 2025-09-12
Test Result Units Reference Range
Hemoglobin 12.6 g/dL 12.0 - 15.5
White Blood Cells 5.9 10^3/uL 4.0 - 11.0
Platelets 365 10^3/uL 150 - 400
Glucose, fasting 95 mg/dL 70 - 99
HbA1c 5.5 % < 5.7
LDL Cholesterol 151 mg/dL < 130 H
HDL Cholesterol 55 mg/dL > 40
TSH 2.4 mIU/L 0.4 - 4.0
Vitamin D 22 ng/mL 30 - 100 L`;

/** Synthetic report where the lab itself marked a critical value. */
export const SAMPLE_CRITICAL_TEXT = `Sample Diagnostics Lab
Patient: Sam Placeholder (synthetic)
Collected date: 2026-04-02
Test Result Units Reference Range
Sodium 134 L mmol/L 135 - 145
Potassium 6.4 HH mmol/L 3.5 - 5.1 CRITICAL
Creatinine 1.1 mg/dL 0.6 - 1.2
Glucose 88 mg/dL 70 - 99`;

export interface SampleDef {
  id: string;
  title: string;
  text: string;
}
export const SAMPLES: SampleDef[] = [
  { id: "baseline", title: "Synthetic report — September 2025", text: SAMPLE_BASELINE_TEXT },
  { id: "followup", title: "Synthetic report — March 2026", text: SAMPLE_TEXT },
  { id: "critical", title: "Synthetic report with a lab critical flag", text: SAMPLE_CRITICAL_TEXT },
];

export const linesOf = (text: string): ExtractedLine[] => text.split("\n").map((t) => ({ text: t, page: 1, confidence: null }));
