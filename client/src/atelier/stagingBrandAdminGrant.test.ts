import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../../supabase/manual/20260910_staging_grant_gjtrade_brand_admin.sql", import.meta.url),
  "utf8"
);

describe("staging brand-admin grant runbook", () => {
  it("limits the direct grant to staging, one existing account, and the Bernese owner organization", () => {
    expect(source).toContain("trhhgmionyyfnbwhxenn");
    expect(source).toContain("Do not run in Production");
    expect(source).toContain("gjtrade@naver.com");
    expect(source).toContain("bernese-memorial-plush-v01");
    expect(source).toContain("Expected exactly one Bernese product organization");
  });

  it("does not create users or mutate authentication configuration", () => {
    expect(source).toContain("insert into public.organization_members");
    expect(source).not.toMatch(/insert\s+into\s+auth\.users/i);
    expect(source).not.toMatch(/alter\s+.*auth/i);
  });
});
