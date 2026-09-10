import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../supabase/migrations/202609100014_reference_product_order_rpc_schema_usage.sql", import.meta.url),
  "utf8"
);

describe("reference product order RPC schema repair", () => {
  it("grants only authenticated callers access to the private function schema", () => {
    expect(source).toContain("revoke all on schema reference_order_private from public, anon");
    expect(source).toContain("grant usage on schema reference_order_private to authenticated");
    expect(source).not.toContain("grant usage on schema reference_order_private to anon");
  });
});
