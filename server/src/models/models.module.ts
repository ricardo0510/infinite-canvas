import { Module } from "@nestjs/common";
import { ByokModule } from "../byok/byok.module";
import { ModelsController } from "./models.controller";

@Module({
  imports: [ByokModule],
  controllers: [ModelsController],
})
export class ModelsModule {}
