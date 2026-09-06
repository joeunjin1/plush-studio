import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../supabase/migrations/202609060010_personalization_profiles.sql", import.meta.url),
  "utf8"
);

describe("personalization profile migration", () => {
  it("keeps reusable method profiles unique per selling organization", () => {
    expect(source).toContain("create table if not exists public.personalization_method_profiles");
    expect(source).toContain("unique (organization_id, code)");
    expect(source).toContain("'memorial_tag', 'screen_print', 'heat_transfer', 'embroidery', 'woven_label', 'patch'");
  });

  it("stores buyer-company-scoped choices and asset paths, never file bytes", () => {
    expect(source).toContain("create table if not exists public.buyer_companies");
    expect(source).toContain("create table if not exists public.buyer_product_personalizations");
    expect(source).toContain("buyer_company_id uuid not null");
    expect(source).toContain("image_storage_path text");
    expect(source).not.toMatch(/bytea|blob/i);
  });

  it("requires company membership for buyer personalization reads and writes", () => {
    expect(source).toContain("create policy \"buyer_personalizations_read_company_or_admin\"");
    expect(source).toContain("public.is_buyer_company_member(buyer_company_id)");
    expect(source).toContain("create policy \"buyer_personalizations_create_company_member\"");
  });
});
