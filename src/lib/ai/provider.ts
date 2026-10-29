import { isAiMock } from "./config";
import { imageProvider, textProvider, videoProvider } from "./providers/taskProvider";
import { mockProvider } from "./providers/mock";
import type { AiProvider, GenerationKind } from "./types";

export function providerFor(kind: GenerationKind): AiProvider {
  if (isAiMock()) return mockProvider;
  if (kind === "text") return textProvider;
  if (kind === "image") return imageProvider;
  return videoProvider;
}
