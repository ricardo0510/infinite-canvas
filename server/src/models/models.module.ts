import { Module } from "@nestjs/common";
import { ByokModule } from "../byok/byok.module";
import { ModelsController } from "./models.controller";
import { ModelsService } from "./models.service";

@Module({
  imports: [ByokModule],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
