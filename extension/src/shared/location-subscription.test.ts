/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { subscribeToLocationChanges } from "./location-subscription";

describe("subscribeToLocationChanges", () => {
  it("invokes callback on popstate", () => {
    const cb = vi.fn();
    const unsub = subscribeToLocationChanges(cb);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("invokes callback on qaf:locationchange (pushState wrapper)", () => {
    const cb = vi.fn();
    const unsub = subscribeToLocationChanges(cb);
    window.dispatchEvent(new Event("qaf:locationchange"));
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("pushState triggers callback via dispatched event", () => {
    const cb = vi.fn();
    const unsub = subscribeToLocationChanges(cb);
    history.pushState({}, "", "/test-push");
    expect(cb).toHaveBeenCalled();
    unsub();
  });
});
