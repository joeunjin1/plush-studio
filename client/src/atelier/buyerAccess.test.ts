import { describe, expect, it } from "vitest";
import { buyerAccessPrompt, buyerEmailRedirectUrl } from "./buyerAccess";

describe("buyer email access boundary", () => {
  it("returns buyers to the exact product and editor route after email authentication", () => {
    const location = new URL("https://plush-studio.vercel.app/?template=tote#atelier") as unknown as Location;
    expect(buyerEmailRedirectUrl(location)).toBe("https://plush-studio.vercel.app/?template=tote#atelier");
  });

  it("explains that guest design remains local at a protected artifact boundary", () => {
    expect(buyerAccessPrompt("부위 분리 GLB")).toContain("이 기기");
  });
});
