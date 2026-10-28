import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStore } from "./toastStore";

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toastStore", () => {
  it("pushes and dismisses toasts", () => {
    useToastStore.getState().push("Saved", "success");
    const [toast] = useToastStore.getState().toasts;
    expect(toast).toMatchObject({ message: "Saved", tone: "success" });

    useToastStore.getState().dismiss(toast.id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("auto-dismisses after a timeout", () => {
    useToastStore.getState().push("Heads up");
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(4500);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("keeps at most four toasts", () => {
    for (let index = 0; index < 6; index++) {
      useToastStore.getState().push(`Message ${index}`);
    }
    expect(useToastStore.getState().toasts).toHaveLength(4);
    expect(useToastStore.getState().toasts[0].message).toBe("Message 2");
  });
});
