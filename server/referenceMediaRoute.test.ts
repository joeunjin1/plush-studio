import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(new URL("../api/reference-media.ts", import.meta.url), "utf8");
const vercelConfig = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8")
) as { rewrites: Array<{ source: string; destination: string }> };

describe("Vercel reference-media proxy", () => {
  it("routes uploaded reference assets before the SPA fallback", () => {
    expect(vercelConfig.rewrites[0]).toEqual({
      source: "/manus-storage/:asset*",
      destination: "/api/reference-media?asset=:asset*",
    });
    expect(vercelConfig.rewrites[1]).toEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });

  it("accepts only bounded safe storage keys and obtains a server-side signed URL", () => {
    expect(route).toContain("function validStorageKey");
    expect(route).toContain("!key.includes(\"..\")");
    expect(route).toContain("BUILT_IN_FORGE_API_KEY");
    expect(route).toContain("v1/storage/presign/get");
    expect(route).toContain("res.statusCode = 307");
  });
});
