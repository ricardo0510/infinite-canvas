import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateApiToken, hashApiToken } from "./security/api-token";

const prisma = new PrismaClient();

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  return process.argv[index + 1]?.trim() || undefined;
}

async function createToken(): Promise<void> {
  const userId = option("user");
  if (!userId) {
    throw new Error("缺少 --user <用户ID>");
  }
  const label = option("label") ?? "default";
  const token = option("token") ?? generateApiToken();
  if (token.length < 16) {
    throw new Error("token 长度至少需要 16 个字符");
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, name: userId },
  });

  try {
    const row = await prisma.apiToken.create({
      data: { userId, name: label, tokenHash: hashApiToken(token) },
    });
    console.log(`已创建 token ${row.id}`);
    console.log(`用户：${userId}`);
    console.log(`名称：${label}`);
    console.log(`令牌：${token}`);
    console.log("令牌只显示这一次，服务端只保存 SHA-256 哈希。");
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new Error("该令牌已经存在");
    }
    throw error;
  }
}

async function revokeToken(): Promise<void> {
  const id = option("id");
  if (!id) throw new Error("缺少 --id <tokenId>");
  const row = await prisma.apiToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  console.log(`已撤销 token ${row.id}（用户 ${row.userId}）`);
}

async function listTokens(): Promise<void> {
  const rows = await prisma.apiToken.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      userId: true,
      name: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  if (rows.length === 0) {
    console.log("暂无 API Token");
    return;
  }
  for (const row of rows) {
    const state = row.revokedAt ? "已撤销" : "有效";
    const lastUsed = row.lastUsedAt?.toISOString() ?? "从未使用";
    console.log(
      `${row.id}  用户=${row.userId}  名称=${row.name}  状态=${state}  最近使用=${lastUsed}`,
    );
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "create";
  if (command === "create") await createToken();
  else if (command === "revoke") await revokeToken();
  else if (command === "list") await listTokens();
  else throw new Error(`未知命令：${command}（可用：create / revoke / list）`);
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
