# local-gateway

把本机 ComfyUI 包装成 Infinite Canvas 后端需要的接口。只依赖 Node 22 内置模块，不需要 `npm install`。

## 启动

先启动 ComfyUI：

```bash
cd ~/ComfyUI
source .venv/bin/activate
python main.py --listen 127.0.0.1 --port 8188 --lowvram
```

再启动网关：

```bash
cd /Users/mrricardo/Documents/project/infinite-canvas
node tools/local-gateway/server.mjs
```

默认监听 `http://127.0.0.1:8081`。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8081` | 网关端口 |
| `COMFY_URL` | `http://127.0.0.1:8188` | ComfyUI 地址 |
| `COMFY_OUTPUT_DIR` | `~/ComfyUI/output` | ComfyUI 输出目录 |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:8081` | 返回给项目的媒体地址前缀 |
| `IMAGE_MODEL` | `sd15` | 图片模型 ID |
| `IMAGE_CHECKPOINT` | `v1-5-pruned-emaonly-fp16.safetensors` | 图片 checkpoint |
| `MAX_IMAGE_SIDE` | `768` | 图片长边上限 |
| `VIDEO_MODEL` | `wan21-t2v-1.3b` | 视频模型 ID |
| `VIDEO_UNET` | `wan2.1_t2v_1.3B_fp16.safetensors` | Wan UNet |
| `VIDEO_TEXT_ENCODER` | `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | Wan T5 |
| `VIDEO_VAE` | `wan_2.1_vae.safetensors` | Wan VAE |
| `VIDEO_WIDTH` / `VIDEO_HEIGHT` | `640` / `384` | 16 GB 上的视频分辨率 |
| `VIDEO_FRAMES` | `25` | 帧数 |
| `VIDEO_FPS` | `16` | 帧率 |
| `VIDEO_STEPS` | `16` | 采样步数 |

## 接口

```text
GET  /v1/models
POST /v1/images/generations
POST /v1/video/submit
POST /v1/video/status
GET  /files/<path>
```

图片：

```bash
curl http://127.0.0.1:8081/v1/images/generations \
  -H 'Content-Type: application/json' \
  -d '{"model":"sd15","prompt":"a cat astronaut","size":"512x512"}'
```

视频：

```bash
curl http://127.0.0.1:8081/v1/video/submit \
  -H 'Content-Type: application/json' \
  -d '{"model":"wan21-t2v-1.3b","prompt":"a fox in snow","image_size":"1280x720"}'

curl http://127.0.0.1:8081/v1/video/status \
  -H 'Content-Type: application/json' \
  -d '{"requestId":"..."}'
```

## 接入项目

在管理端新增两个 Provider（Key 随便填 `local`）：

| id | name | adapter | baseUrl | supportsModels |
| --- | --- | --- | --- | --- |
| `local-image` | 本地图片 | `openai-compatible` | `http://host.docker.internal:8081/v1` | false |
| `local-video` | 本地视频 | `openai-compatible` | `http://host.docker.internal:8081/v1` | false |

ProviderModel：

| providerId | modelId | kind | capabilities |
| --- | --- | --- | --- |
| local-image | `sd15` | image | `{"aspectRatios":["1:1","16:9","9:16"],"resolutions":["1k"],"maxCount":1,"modes":["textToImage","imageToImage"]}` |
| local-video | `wan21-t2v-1.3b` | video | `{"modes":["textToVideo"],"aspectRatios":["16:9","9:16"],"resolutions":["480p"],"minDuration":1,"maxDuration":2,"supportsAudio":false}` |

> 项目只接受 `https://` 媒体地址。本地网关返回的是 `http://127.0.0.1:8081/files/...`，需要改前端 `src/lib/storage.ts` / `src/lib/ai/media.ts` 放行 localhost HTTP，或者给网关套一层 HTTPS。
