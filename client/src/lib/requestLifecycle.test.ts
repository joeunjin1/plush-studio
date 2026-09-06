import { describe, expect, it } from "vitest";
import { canTransitionRequest, nextRequestStages } from "./requestLifecycle";

describe("customer request lifecycle", () => {
  it("allows the approved production sequence only", () => {
    expect(canTransitionRequest("received", "reviewing")).toBe(true);
    expect(canTransitionRequest("confirmed", "sample_review")).toBe(true);
    expect(canTransitionRequest("production_qa", "completed")).toBe(true);
  });

  it("rejects skipped and terminal-stage transitions", () => {
    expect(canTransitionRequest("received", "completed")).toBe(false);
    expect(canTransitionRequest("completed", "reviewing")).toBe(false);
    expect(nextRequestStages("closed")).toEqual([]);
  });
});
