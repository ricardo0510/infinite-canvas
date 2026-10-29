import type { AiProvider, GenerateInput, GenerationEvent } from "../types";
import type { GenerationResultItem } from "../../../types";

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function wait(ms: number, signal: { aborted: boolean }): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      if (!signal.aborted) resolve();
    }, ms);
  });
}

function mockImage(prompt: string, index: number): string {
  const label = (prompt.trim() || "Mock image").slice(0, 42).replace(/[<>&]/g, "");
  const hue = (index * 67 + 210) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 28%)"/><stop offset="1" stop-color="hsl(${(hue + 90) % 360} 70% 52%)"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><circle cx="760" cy="250" r="220" fill="rgba(255,255,255,.14)"/><circle cx="230" cy="820" r="300" fill="rgba(0,0,0,.18)"/><text x="64" y="520" fill="white" font-family="Inter, sans-serif" font-size="52" font-weight="600">${label}</text><text x="64" y="590" fill="rgba(255,255,255,.72)" font-family="Inter, sans-serif" font-size="30">Mock image ${index + 1}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const mockProvider: AiProvider = {
  async generate(input: GenerateInput, emit: (event: GenerationEvent) => void) {
    const signal = { aborted: false };
    void (async () => {
      await wait(input.kind === "text" ? 700 : 1200, signal);
      if (signal.aborted) return;
      if (input.kind === "text") {
        const text = input.prompt.trim()
          ? `这是模拟生成的文本结果。\n\n提示词：${input.prompt.trim()}\n\n接入真实接口后，这里会返回模型生成的完整内容。`
          : "这是模拟生成的文本结果。";
        emit({
          type: "completed",
          results: [
            {
              id: id("mock_text"),
              kind: "text",
              text,
              modelId: input.modelId,
              createdAt: new Date().toISOString(),
            },
          ],
        });
        return;
      }
      if (input.kind === "image") {
        const count = Math.min(4, Math.max(1, input.params.count ?? 1));
        const results: GenerationResultItem[] = Array.from({ length: count }, (_, index) => ({
          id: id("mock_image"),
          kind: "image",
          url: mockImage(input.prompt, index),
          modelId: input.modelId,
          createdAt: new Date().toISOString(),
          width: 1024,
          height: 1024,
        }));
        emit({ type: "completed", results });
        return;
      }
      const poster = mockImage(input.prompt, 0);
      emit({
        type: "completed",
        results: [
          {
            id: id("mock_video"),
            kind: "video",
            url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
            thumbnailUrl: poster,
            duration: input.params.duration ?? 5,
            width: 1280,
            height: 720,
            modelId: input.modelId,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    })();
    return {
      cancel: () => {
        signal.aborted = true;
      },
    };
  },
};
