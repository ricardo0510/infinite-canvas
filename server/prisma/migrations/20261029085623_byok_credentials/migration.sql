-- AlterTable
ALTER TABLE "ProviderConfig" ADD COLUMN     "adapter" TEXT NOT NULL DEFAULT 'openai-compatible',
ADD COLUMN     "authType" TEXT NOT NULL DEFAULT 'bearer',
ADD COLUMN     "docsUrl" TEXT,
ADD COLUMN     "supportsModels" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "credentialId" TEXT,
ADD COLUMN     "providerId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "capabilities" JSONB,
    "source" TEXT NOT NULL DEFAULT 'sync',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProviderCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '默认',
    "apiKeyEncrypted" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "keyMask" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastVerifiedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModelPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerModelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserModelPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken"("userId");

-- CreateIndex
CREATE INDEX "ProviderModel_providerId_kind_idx" ON "ProviderModel"("providerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderModel_providerId_modelId_key" ON "ProviderModel"("providerId", "modelId");

-- CreateIndex
CREATE INDEX "UserProviderCredential_userId_providerId_idx" ON "UserProviderCredential"("userId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProviderCredential_userId_providerId_label_key" ON "UserProviderCredential"("userId", "providerId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "UserModelPreference_userId_providerModelId_key" ON "UserModelPreference"("userId", "providerModelId");

-- CreateIndex
CREATE INDEX "Task_credentialId_idx" ON "Task"("credentialId");

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderModel" ADD CONSTRAINT "ProviderModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProviderCredential" ADD CONSTRAINT "UserProviderCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProviderCredential" ADD CONSTRAINT "UserProviderCredential_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModelPreference" ADD CONSTRAINT "UserModelPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModelPreference" ADD CONSTRAINT "UserModelPreference_providerModelId_fkey" FOREIGN KEY ("providerModelId") REFERENCES "ProviderModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
