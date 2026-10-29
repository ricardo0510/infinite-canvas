-- CreateTable
CREATE TABLE "ModelConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "modes" JSONB NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "limits" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "params" JSONB,
    "pricing" JSONB,
    "providerId" TEXT,
    "providerModel" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "model" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 120000,
    "concurrency" INTEGER NOT NULL DEFAULT 4,
    "extra" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);
