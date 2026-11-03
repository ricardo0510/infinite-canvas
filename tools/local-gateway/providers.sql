-- 本地图片/视频 Provider。执行后还需要在 AI 设置里绑定假 Key（local），或运行 install.sh。
insert into "ProviderConfig"
  (id, name, type, adapter, "baseUrl", "authType", "supportsModels", "timeoutMs", enabled, "createdAt", "updatedAt")
values
  ('local-image', '本地图片', 'local', 'openai-compatible', 'http://host.docker.internal:8081/v1', 'bearer', false, 180000, true, now(), now()),
  ('local-video', '本地视频', 'local', 'openai-compatible', 'http://host.docker.internal:8081/v1', 'bearer', false, 180000, true, now(), now()),
  ('local-audio', '本地语音', 'local', 'openai-compatible', 'http://host.docker.internal:8081/v1', 'bearer', false, 600000, true, now(), now())
on conflict (id) do update set
  name = excluded.name,
  adapter = excluded.adapter,
  "baseUrl" = excluded."baseUrl",
  "authType" = excluded."authType",
  "supportsModels" = excluded."supportsModels",
  "timeoutMs" = excluded."timeoutMs",
  enabled = excluded.enabled,
  "updatedAt" = now();

insert into "ProviderModel"
  (id, "providerId", "modelId", "displayName", kind, capabilities, source, enabled, "createdAt", "updatedAt")
values
  (
    gen_random_uuid(),
    'local-image',
    'flux2-klein-4b',
    'FLUX.2 Klein 4B',
    'image',
    '{"aspectRatios":["1:1","16:9","9:16","4:3","3:4"],"resolutions":["1k"],"maxCount":1,"modes":["textToImage"],"maxImages":1,"maxPromptLength":4000}'::jsonb,
    'manual',
    true,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'local-image',
    'sd15',
    'SD 1.5',
    'image',
    '{"aspectRatios":["1:1","16:9","9:16","4:3","3:4"],"resolutions":["1k"],"maxCount":1,"modes":["textToImage","imageToImage"],"maxImages":1,"maxPromptLength":2000}'::jsonb,
    'manual',
    true,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'local-video',
    'wan21-t2v-1.3b',
    'Wan2.1 T2V 1.3B',
    'video',
    '{"modes":["textToVideo"],"aspectRatios":["16:9","9:16"],"resolutions":["480p"],"minDuration":1,"maxDuration":2,"supportsAudio":false,"maxImages":1,"maxPromptLength":2000}'::jsonb,
    'manual',
    true,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'local-audio',
    'breeze-tts-2',
    'Breeze TTS 2',
    'audio',
    '{"modes":["textToSpeech"],"formats":["wav"],"voices":[],"supportsInstructions":true,"maxInputLength":2000,"maxPromptLength":2000}'::jsonb,
    'manual',
    true,
    now(),
    now()
  )
on conflict ("providerId", "modelId") do update set
  "displayName" = excluded."displayName",
  kind = excluded.kind,
  capabilities = excluded.capabilities,
  enabled = excluded.enabled,
  "updatedAt" = now();
