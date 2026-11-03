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
| `IMAGE_MODEL` | `flux2-klein-4b` | 默认图片模型 ID |
| `IMAGE_CHECKPOINT` | `v1-5-pruned-emaonly-fp16.safetensors` | SD 1.5 checkpoint（备用） |
| `FLUX2_UNET` | `flux-2-klein-4b-fp8.safetensors` | FLUX.2 Klein 4B 扩散模型 |
| `FLUX2_TEXT_ENCODER` | `qwen_3_4b_fp4_flux2.safetensors` | FLUX.2 文本编码器 |
| `FLUX2_VAE` | `flux2-vae.safetensors` | FLUX.2 VAE |
| `MAX_IMAGE_SIDE` | `768` | SD 1.5 长边上限；FLUX.2 固定用 1024 |
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
# FLUX.2 Klein 4B（推荐）
curl http://127.0.0.1:8081/v1/images/generations \
  -H 'Content-Type: application/json' \
  -d '{"model":"flux2-klein-4b","prompt":"a cat astronaut","size":"1024x1024"}'

# SD 1.5（备用，支持参考图 img2img）
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
| local-image | `flux2-klein-4b` | image | `{"aspectRatios":["1:1","16:9","9:16"],"resolutions":["1k"],"maxCount":1,"modes":["textToImage"]}` |
| local-image | `sd15` | image | `{"aspectRatios":["1:1","16:9","9:16"],"resolutions":["1k"],"maxCount":1,"modes":["textToImage","imageToImage"]}` |
| local-video | `wan21-t2v-1.3b` | video | `{"modes":["textToVideo"],"aspectRatios":["16:9","9:16"],"resolutions":["480p"],"minDuration":1,"maxDuration":2,"supportsAudio":false}` |

> 项目只接受 `https://` 媒体地址。本地网关返回的是 `http://127.0.0.1:8081/files/...`，需要改前端 `src/lib/storage.ts` / `src/lib/ai/media.ts` 放行 localhost HTTP，或者给网关套一层 HTTPS。
