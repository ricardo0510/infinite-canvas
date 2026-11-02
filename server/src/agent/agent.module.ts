import { Module } from "@nestjs/common";
import { ByokModule } from "../byok/byok.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";

@Module({
  imports: [ByokModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
