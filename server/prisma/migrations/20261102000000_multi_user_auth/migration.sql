-- 多用户鉴权启用后，User.email 不再使用；ProviderConfig 和 ModelConfig 的死字段一并移除。
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";

ALTER TABLE "ProviderConfig"
  DROP COLUMN IF EXISTS "apiKeyEncrypted",
  DROP COLUMN IF EXISTS "model",
  DROP COLUMN IF EXISTS "concurrency";

ALTER TABLE "ModelConfig"
  DROP COLUMN IF EXISTS "providerId",
  DROP COLUMN IF EXISTS "providerModel";
