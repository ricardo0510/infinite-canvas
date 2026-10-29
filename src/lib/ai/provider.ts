import { imageProvider, textProvider, videoProvider } from "./providers/taskProvider";
import type { AiProvider, GenerationKind } from "./types";

export function providerFor(kind: GenerationKind): AiProvider {
  if (kind === "text") return textProvider;
  if (kind === "image") return imageProvider;
  return videoProvider;
}
