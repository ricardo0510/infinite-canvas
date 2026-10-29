import type { AiModel } from "./model.types";

export const SEED_MODELS: AiModel[] = [
  {
    id: "mock-text",
    name: "模拟文本",
    kind: "text",
    modes: [],
    description: "本地模拟文本模型",
    limits: { maxPromptLength: 8000, maxImages: 0, maxVideos: 0 },
    output: { image: null, video: null },
  },
  {
    id: "mock-image",
    name: "模拟图片",
    kind: "image",
    modes: ["textToImage", "imageToImage"],
    description: "本地模拟图片模型",
    limits: { maxPromptLength: 2000, maxImages: 4, maxVideos: 0 },
    output: {
      image: {
        aspectRatios: ["1:1", "4:3", "16:9", "9:16"],
        resolutions: ["1k", "2k"],
        maxCount: 4,
      },
      video: null,
    },
    params: {
      qualityTiers: [
        { key: "standard", label: "标准" },
        { key: "high", label: "高清" },
      ],
      backgrounds: ["opaque", "transparent", "auto"],
    },
  },
  {
    id: "mock-video",
    name: "模拟视频",
    kind: "video",
    modes: ["textToVideo", "imageToVideo", "firstLastFrame", "referenceVideo"],
    description: "本地模拟视频模型",
    limits: { maxPromptLength: 2000, maxImages: 2, maxVideos: 1 },
    output: {
      image: null,
      video: {
        aspectRatios: ["16:9", "9:16", "1:1"],
        resolutions: ["480p", "720p", "1080p"],
        minDuration: 4,
        maxDuration: 12,
        supportsAudio: true,
      },
    },
    params: {
      qualityTiers: [
        { key: "standard", label: "标准" },
        { key: "high", label: "高清" },
      ],
    },
  },
];
