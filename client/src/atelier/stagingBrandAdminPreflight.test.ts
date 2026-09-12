import { describe, expect, it } from "vitest";
import sql from "../../../supabase/manual/20260910_staging_brand_admin_preflight.sql?raw";
import singleResultSql from "../../../supabase/manual/20260910_staging_brand_admin_preflight_single_result.sql?raw";

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

  it("offers a single SELECT variant so the SQL Editor visibly shows the result rows", () => {
    expect(singleResultSql).toContain("target_user_role");
    expect(singleResultSql).toContain("reference_product_count");
    expect(singleResultSql).not.toMatch(/\b(begin|commit|rollback)\b/i);
    expect(singleResultSql).not.toMatch(/\b(insert|update|delete|grant|revoke|create|alter|drop)\b/i);
    expect(singleResultSql).not.toContain("source_storage_path");
    expect(singleResultSql).not.toContain("personalization_text");
  });
});
