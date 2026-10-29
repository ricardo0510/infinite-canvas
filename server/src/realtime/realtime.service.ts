import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ApiException } from "../common/api-exception";

type Ticket = {
  userId: string;
  expiresAt: number;
  used: boolean;
};

@Injectable()
export class RealtimeService {
  private readonly tickets = new Map<string, Ticket>();

  issue(userId: string): { ticket: string; expiresAt: string } {
    const ticket = `rt_${randomUUID()}`;
    const expiresAt = Date.now() + 60_000;
    this.tickets.set(ticket, { userId, expiresAt, used: false });
    this.cleanup();
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }

  consume(ticket: string | null): string {
    if (!ticket) throw new ApiException(10007, "缺少实时票据", 401);
    const record = this.tickets.get(ticket);
    if (!record || record.used || record.expiresAt < Date.now()) {
      throw new ApiException(10007, "票据已过期或已使用", 401);
    }
    record.used = true;
    this.tickets.delete(ticket);
    return record.userId;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ticket, record] of this.tickets) {
      if (record.expiresAt < now) this.tickets.delete(ticket);
    }
  }
}
