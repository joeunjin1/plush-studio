import { describe, expect, it } from "vitest";

const expectedTables = [
  "profiles", "organizations", "organization_members", "projects", "project_members",
  "plush_designs", "design_versions", "plush_parts", "project_assets", "bom_items",
  "cost_scenarios", "factory_quotes", "factory_quote_lines", "samples", "sample_feedback",
  "qa_checklist_items", "qa_inspections", "qa_results", "production_orders", "approvals", "audit_events",
];

function config() {
  const url = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

describe("Supabase plush-studio foundation", () => {
  it("has every manufacturing collaboration table exposed to the secured Data API", async () => {
    const { url, headers } = config();
    expect(url).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);

    const results = await Promise.all(expectedTables.map(async table => ({
      table,
      response: await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers }),
    })));
    const unavailable = results.filter(({ response }) => response.status !== 200).map(({ table, response }) => `${table}:${response.status}`);
    expect(unavailable).toEqual([]);
  });

  it("has the private plush-studio asset bucket and required access-control functions", async () => {
    const { url, headers } = config();
    const bucket = await fetch(`${url}/storage/v1/bucket/plush-studio`, { headers });
    expect(bucket.status).toBe(200);
    const bucketBody = await bucket.json() as { public?: boolean };
    expect(bucketBody.public).toBe(false);

    const emptyId = "00000000-0000-0000-0000-000000000000";
    const responses = await Promise.all([
      fetch(`${url}/rest/v1/rpc/is_org_member`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ target_organization_id: emptyId }) }),
      fetch(`${url}/rest/v1/rpc/has_org_role`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ target_organization_id: emptyId, accepted_roles: ["brand_admin"] }) }),
      fetch(`${url}/rest/v1/rpc/can_view_project`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ target_project_id: emptyId }) }),
      fetch(`${url}/rest/v1/rpc/can_edit_project`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ target_project_id: emptyId }) }),
      fetch(`${url}/rest/v1/rpc/can_manage_project`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ target_project_id: emptyId }) }),
      fetch(`${url}/rest/v1/rpc/can_contribute_to_project`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ target_project_id: emptyId }) }),
      fetch(`${url}/rest/v1/rpc/can_inspect_project`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ target_project_id: emptyId }) }),
      fetch(`${url}/rest/v1/rpc/is_bucket_path_member`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ object_name: `${emptyId}/sample/file.png` }) }),
    ]);
    expect(responses.map(response => response.status)).toEqual([200, 200, 200, 200, 200, 200, 200, 200]);
  });
});
