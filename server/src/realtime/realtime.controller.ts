import { Controller, Post } from "@nestjs/common";
import type { AuthUser } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { RealtimeService } from "./realtime.service";

@Controller("realtime")
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Post("tickets")
  issue(@CurrentUser() user: AuthUser) {
    return this.realtime.issue(user.id);
  }
}
