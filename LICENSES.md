# Licenses

## Application code
Choose a license before publishing (MIT is suggested). The repository does not yet contain a LICENSE file.

## Models (downloaded at runtime, not bundled)
| Model | Source | License |
|---|---|---|
| Gemma 4 E2B-it (ONNX, q4f16) | `onnx-community/gemma-4-E2B-it-ONNX` | Apache-2.0 (per model card) — see Google's Gemma terms: https://ai.google.dev/gemma/docs/gemma_4_license |
| Kokoro-82M v1.0 (ONNX) | `onnx-community/Kokoro-82M-v1.0-ONNX` | Apache-2.0 |
| Whisper base (ONNX) | `onnx-community/whisper-base` (OpenAI Whisper) | MIT |
| Tesseract English traineddata | tessdata via jsDelivr | Apache-2.0 |

Check each model card before redistribution.

## Educational content
`src/lib/ai/knowledge.json` contains summaries written for this project (CC BY 4.0). Facts were checked against MedlinePlus (U.S. National Library of Medicine). MedlinePlus text is generally in the public domain; links are included per entry.

## Key dependencies
| Package | License |
|---|---|
| React, TanStack Router/Start, Vite | MIT |
| Tailwind CSS, shadcn/ui, Radix UI, lucide-react | MIT / ISC |
| pdfjs-dist | Apache-2.0 |
| tesseract.js | Apache-2.0 |
| dexie | Apache-2.0 |
| @huggingface/transformers, onnxruntime-web | Apache-2.0 / MIT |
| kokoro-js | Apache-2.0 |
| zod | MIT |

## Optional service
ElevenLabs is a commercial API governed by its own terms. It is only used when the user turns it on.

## Demo data
`demo-reports/` contains synthetic reports created for this project. They describe no real person.
