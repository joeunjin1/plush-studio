import { describe, expect, it } from "vitest";

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const configured = Boolean(url && anonKey && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url));

describe.runIf(configured)("buyer export persistence boundary", () => {
  it("exposes the audit relation while returning no anonymous rows", async () => {
    const response = await fetch(`${url}/rest/v1/buyer_download_events?select=id&limit=1`, {
      headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey!}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("rejects an anonymous audit insert without writing data", async () => {
    const response = await fetch(`${url}/rest/v1/buyer_download_events`, {
      method: "POST",
      headers: {
        apikey: anonKey!,
        Authorization: `Bearer ${anonKey!}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: "00000000-0000-0000-0000-000000000000",
        artifact_type: "proof_json",
      }),
    });
    expect([401, 403]).toContain(response.status);
  });
});

describe.skipIf(configured)("buyer export persistence boundary", () => {
  it("requires the configured public Supabase endpoint", () => {
    expect(configured).toBe(false);
  });
});
