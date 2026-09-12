import { describe, expect, it } from "vitest";
import sql from "../../../supabase/manual/20260910_staging_bootstrap_plush_studio_brand_admin.sql?raw";

describe("staging brand-admin bootstrap SQL", () => {
  it("requires an empty organization table before creating one staging organization", () => {
    expect(sql).toContain("STAGING_BOOTSTRAP_REQUIRES_EMPTY_ORGANIZATIONS");
    expect(sql).toContain("'Plush Studio Staging'");
    expect(sql).toContain("'plush-studio-staging'");
    expect(sql).toContain("select count(*)::integer");
  });

  it("creates no Auth identity and grants only the target user one brand_admin membership", () => {
    expect(sql).toContain("auth.users");
    expect(sql).toContain("'brand_admin'");
    expect(sql).not.toMatch(/\b(create user|alter user|password|grant .*auth|update auth\.users|delete from auth\.users)\b/i);
    expect(sql).not.toContain("storage.objects");
    expect(sql).not.toContain("source_storage_path");
  });

  it("returns only the non-sensitive staging bootstrap verification metadata", () => {
    const finalSelect = sql.slice(sql.lastIndexOf("select\n"));
    expect(finalSelect).toContain("organization_id");
    expect(finalSelect).toContain("organization_slug");
    expect(finalSelect).toContain("target_user_role");
    expect(finalSelect).not.toContain("target_user.email as");
  });
});
