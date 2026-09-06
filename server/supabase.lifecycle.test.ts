import { describe, expect, it } from "vitest";

function config() {
  const url = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

describe("Supabase customer request lifecycle", () => {
  it("exposes the transition audit note column", async () => {
    const { url, headers } = config();
    const response = await fetch(`${url}/rest/v1/customer_request_events?select=transition_note&limit=0`, { headers });
    expect(response.status).toBe(200);
  });

  it("has the protected lifecycle transition RPC", async () => {
    const { url, headers } = config();
    const response = await fetch(`${url}/rest/v1/rpc/transition_customer_request`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_request_id: "00000000-0000-0000-0000-000000000000",
        p_to_status: "reviewing",
        p_note: "read-only function existence verification",
      }),
    });
    const body = await response.text();
    expect(body).not.toContain("Could not find the function");
    expect(body).not.toContain("PGRST202");
  });
});
