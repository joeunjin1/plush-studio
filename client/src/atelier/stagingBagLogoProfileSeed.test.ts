import { describe, expect, it } from "vitest";
import sql from "../../../supabase/manual/20260912_staging_seed_bag_logo_profiles.sql?raw";

describe("staging bag logo profile seed", () => {
  it("limits seeded profiles to reusable bag logo methods", () => {
    expect(sql).toContain("FRONT_SCREEN_PRINT_V01");
    expect(sql).toContain("FRONT_EMBROIDERY_V01");
    expect(sql).toContain("array['bag']::text[]");
    expect(sql).toContain("'image'");
    expect(sql).toContain("'text_or_image'");
  });

  it("requires the staging organization and existing brand_admin without creating identities", () => {
    expect(sql).toContain("plush-studio-staging");
    expect(sql).toContain("TARGET_USER_IS_NOT_BRAND_ADMIN");
    expect(sql).toContain("on conflict (organization_id, code) do nothing");
    expect(sql).not.toMatch(/\bcreate\s+(user|role)|alter\s+role|password\b/i);
  });

  it("does not create products, orders, or storage objects", () => {
    expect(sql).not.toContain("reference_products");
    expect(sql).not.toContain("reference_product_order_requests");
    expect(sql).not.toContain("storage.objects");
  });
});
