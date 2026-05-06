export interface HiggsfieldModelCost {
  generationModel: string;
  higgsfieldModelId: string;
  label: string;
  unit: string;
  credits: number | null;
  resolution?: string | null;
  quality?: string | null;
  notes: string;
}

const perImage = "Configured website price per generated image. Total run cost is this value multiplied by quantity.";
const gptPerImage = "Configured GPT Image 2 website price per generated image for this resolution and quality. Total run cost is this value multiplied by quantity.";
const localAddon = "Configured local website add-on price per image.";

export const HIGGSFIELD_MODEL_COSTS: HiggsfieldModelCost[] = [
  { generationModel: "nb_pro", higgsfieldModelId: "nano_banana_2", label: "Nano Banana Pro", unit: "image", resolution: "1k", credits: 2, notes: perImage },
  { generationModel: "nb_pro", higgsfieldModelId: "nano_banana_2", label: "Nano Banana Pro", unit: "image", resolution: "2k", credits: 2, notes: perImage },
  { generationModel: "nb_pro", higgsfieldModelId: "nano_banana_2", label: "Nano Banana Pro", unit: "image", resolution: "4k", credits: 4, notes: perImage },
  { generationModel: "nb2", higgsfieldModelId: "nano_banana_flash", label: "Nano Banana 2", unit: "image", resolution: "1k", credits: 1.5, notes: perImage },
  { generationModel: "nb2", higgsfieldModelId: "nano_banana_flash", label: "Nano Banana 2", unit: "image", resolution: "2k", credits: 2, notes: perImage },
  { generationModel: "nb2", higgsfieldModelId: "nano_banana_flash", label: "Nano Banana 2", unit: "image", resolution: "4k", credits: 3, notes: perImage },
  { generationModel: "sd_4_5", higgsfieldModelId: "seedream_v4_5", label: "Seedream 4.5", unit: "image", resolution: "2k", credits: 1, notes: perImage },
  { generationModel: "sd_4_5", higgsfieldModelId: "seedream_v4_5", label: "Seedream 4.5", unit: "image", resolution: "4k", credits: 1, notes: perImage },
  { generationModel: "gpt_2", higgsfieldModelId: "gpt_image_2", label: "GPT Image 2", unit: "image", resolution: "1k", quality: "low", credits: 0.5, notes: gptPerImage },
  { generationModel: "gpt_2", higgsfieldModelId: "gpt_image_2", label: "GPT Image 2", unit: "image", resolution: "2k", quality: "low", credits: 0.75, notes: gptPerImage },
  { generationModel: "gpt_2", higgsfieldModelId: "gpt_image_2", label: "GPT Image 2", unit: "image", resolution: "4k", quality: "low", credits: 1, notes: gptPerImage },
  { generationModel: "gpt_2", higgsfieldModelId: "gpt_image_2", label: "GPT Image 2", unit: "image", resolution: "1k", quality: "medium", credits: 2, notes: gptPerImage },
  { generationModel: "gpt_2", higgsfieldModelId: "gpt_image_2", label: "GPT Image 2", unit: "image", resolution: "2k", quality: "medium", credits: 3, notes: gptPerImage },
  { generationModel: "gpt_2", higgsfieldModelId: "gpt_image_2", label: "GPT Image 2", unit: "image", resolution: "4k", quality: "medium", credits: 6, notes: gptPerImage },
  { generationModel: "gpt_2", higgsfieldModelId: "gpt_image_2", label: "GPT Image 2", unit: "image", resolution: "1k", quality: "high", credits: 4, notes: gptPerImage },
  { generationModel: "gpt_2", higgsfieldModelId: "gpt_image_2", label: "GPT Image 2", unit: "image", resolution: "2k", quality: "high", credits: 7, notes: gptPerImage },
  { generationModel: "gpt_2", higgsfieldModelId: "gpt_image_2", label: "GPT Image 2", unit: "image", resolution: "4k", quality: "high", credits: 12, notes: gptPerImage },
  { generationModel: "z_image", higgsfieldModelId: "z_image", label: "Z Image", unit: "image", credits: 0.15, notes: "Configured website price per generated image. Z Image uses aspect ratio only; no resolution selector is shown." },
  { generationModel: "flux_kontext", higgsfieldModelId: "flux_kontext", label: "Flux Kontext Max", unit: "image", credits: 1.5, notes: "Configured website price per generated image. Flux Kontext Max uses aspect ratio only; no resolution selector is shown." },
  { generationModel: "kling_o1", higgsfieldModelId: "kling_omni_image", label: "Kling O1 Image", unit: "image", resolution: "1k", credits: 0.5, notes: perImage },
  { generationModel: "kling_o1", higgsfieldModelId: "kling_omni_image", label: "Kling O1 Image", unit: "image", resolution: "2k", credits: 0.5, notes: perImage },
  { generationModel: "sdxl", higgsfieldModelId: "sdxl", label: "SDXL Image", unit: "image", credits: 0.01, notes: localAddon },
  { generationModel: "upscale", higgsfieldModelId: "upscale", label: "Upscale", unit: "image", credits: 0.01, notes: localAddon },
  { generationModel: "face_swap", higgsfieldModelId: "face_swap", label: "FaceSwap", unit: "image", credits: 0.1, notes: localAddon },
  { generationModel: "flux_2", higgsfieldModelId: "flux_2", label: "Flux 2 Pro", unit: "image", resolution: "1k", credits: 4, notes: perImage },
  { generationModel: "flux_2", higgsfieldModelId: "flux_2", label: "Flux 2 Pro", unit: "image", resolution: "2k", credits: 6, notes: perImage },
  { generationModel: "sd_2_0", higgsfieldModelId: "seedance_2_0", label: "Seedance 2.0", unit: "5 sec video", resolution: "480p", credits: 45, notes: "Existing video price mapping." },
  { generationModel: "sd_2_0", higgsfieldModelId: "seedance_2_0", label: "Seedance 2.0", unit: "5 sec video", resolution: "720p", credits: 67.5, notes: "Existing video price mapping." },
  { generationModel: "sd_2_0", higgsfieldModelId: "seedance_2_0", label: "Seedance 2.0", unit: "5 sec video", resolution: "1080p", credits: 135, notes: "Existing video price mapping." },
  { generationModel: "sd_2_0_fast", higgsfieldModelId: "seedance_2_0", label: "Seedance 2.0 Fast", unit: "5 sec video", resolution: "480p", credits: 45, notes: "Website alias for Seedance 2.0; mode is intentionally not sent by the simplified MCP node." },
  { generationModel: "sd_2_0_fast", higgsfieldModelId: "seedance_2_0", label: "Seedance 2.0 Fast", unit: "5 sec video", resolution: "720p", credits: 67.5, notes: "Website alias for Seedance 2.0; mode is intentionally not sent by the simplified MCP node." },
  { generationModel: "sd_2_0_fast", higgsfieldModelId: "seedance_2_0", label: "Seedance 2.0 Fast", unit: "5 sec video", resolution: "1080p", credits: 135, notes: "Website alias for Seedance 2.0; mode is intentionally not sent by the simplified MCP node." },
  { generationModel: "kling_3_0", higgsfieldModelId: "kling3_0", label: "Kling 3.0", unit: "5 sec video", credits: 6, notes: "Existing video price mapping." },
];
