import { describe, expect, it } from "vitest";
import sql from "../../../supabase/manual/20260910_staging_brand_admin_preflight.sql?raw";

describe("staging brand-admin preflight SQL", () => {
  it("is read-only and reports only membership status needed for the UAT", () => {
    expect(sql).toContain("begin read only;");
    expect(sql).toContain("rollback;");
    expect(sql).toContain("target_user_role");
    expect(sql).toContain("reference_product_count");
  });

  it("does not create or modify identities, permissions, storage, or product data", () => {
    const executableSql = sql.replace(/--.*$/gm, "");
    expect(executableSql).not.toMatch(/\b(insert|update|delete|grant|revoke|create|alter|drop)\b/i);
    expect(sql).not.toContain("source_storage_path");
    expect(sql).not.toContain("personalization_text");
  });
});
