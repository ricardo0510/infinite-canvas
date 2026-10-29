import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const databaseUrl = config.get<string>("DATABASE_URL");
    super(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
