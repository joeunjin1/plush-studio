import { describe, expect, it } from "vitest";

function getProjectUrl() {
  return (process.env.VITE_SUPABASE_URL ?? "")
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "");
}

describe("Supabase plush-studio schema", () => {
  it("exposes the material field required by the versioned plush part save flow", async () => {
    const url = getProjectUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(url).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
    expect(key?.length ?? 0).toBeGreaterThan(20);

    const response = await fetch(`${url}/rest/v1/plush_parts?select=material&limit=0`, {
      headers: { apikey: key!, Authorization: `Bearer ${key}` },
    });
    expect(response.status).toBe(200);
  });
});
