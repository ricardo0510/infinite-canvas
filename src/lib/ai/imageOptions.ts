/**
 * 图片参数的唯一来源在服务端 `server/src/models/image-options.ts`。
 * 前端只做 re-export，避免两份常量漂移。
 */
export {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_RESOLUTION,
  formatImageResolution,
  IMAGE_ASPECT_RATIOS,
  IMAGE_MAX_COUNT,
  IMAGE_RESOLUTIONS,
} from "../../../server/src/models/image-options";
