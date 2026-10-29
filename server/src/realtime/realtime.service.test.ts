import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { ApiException } from "../common/api-exception";
import { RealtimeService } from "./realtime.service";

describe("RealtimeService", () => {
  it("issues a one-time ticket and consumes it once", () => {
    const realtime = new RealtimeService();
    const { ticket } = realtime.issue("user-1");

    expect(realtime.consume(ticket)).toBe("user-1");
    expect(() => realtime.consume(ticket)).toThrow(ApiException);
  });

  it("rejects a missing ticket", () => {
    const realtime = new RealtimeService();
    expect(() => realtime.consume(null)).toThrow(ApiException);
  });
});
