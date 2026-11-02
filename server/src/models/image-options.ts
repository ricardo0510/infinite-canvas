export const IMAGE_ASPECT_RATIOS = [
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "5:4",
  "4:5",
  "16:9",
  "9:16",
  "21:9",
] as const;

export const IMAGE_RESOLUTIONS = ["auto", "1k", "1.5k", "2k", "3k", "4k"] as const;

export const IMAGE_MAX_COUNT = 4;
export const DEFAULT_IMAGE_ASPECT_RATIO = "1:1";
export const DEFAULT_IMAGE_RESOLUTION = "1k";

export function formatImageResolution(value: string): string {
  const lower = value.toLowerCase();
  if (lower === "auto" || lower === "adaptive") return "自适应";
  return /^\d+(?:\.\d+)?k$/.test(lower) ? lower.toUpperCase() : value;
}

export function appendImageOptions(
  prompt: string,
  params: { aspectRatio?: string; resolution?: string },
): string {
  const parts: string[] = [];
  if (params.aspectRatio) parts.push(`aspect ratio ${params.aspectRatio}`);
  if (params.resolution) {
    const resolution =
      params.resolution.toLowerCase() === "auto"
        ? "auto"
        : formatImageResolution(params.resolution);
    parts.push(`resolution ${resolution}`);
  }
  if (parts.length === 0) return prompt;
  return `${prompt}\n\nOutput image settings: ${parts.join(", ")}.`;
}
