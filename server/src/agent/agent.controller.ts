import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import type { AuthUser } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { AgentService } from "./agent.service";
import { AgentChatDto } from "./dto/agent-chat.dto";

@Controller("agent")
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post("chat")
  @HttpCode(200)
  chat(@CurrentUser() user: AuthUser, @Body() dto: AgentChatDto) {
    return this.agent.chat(user.id, dto);
  }
}
