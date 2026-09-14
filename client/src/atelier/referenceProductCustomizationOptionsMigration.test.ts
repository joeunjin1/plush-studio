import { describe, expect, it } from "vitest";
import sql from "../../../supabase/migrations/202609120018_reference_product_customization_options.sql?raw";

describe("reference product customization options migration", () => {
  it("stores only per-SKU option metadata and restricts option management to brand admins", () => {
    expect(sql).toContain("reference_product_customization_options");
    expect(sql).toContain("option_kind in ('color')");
    expect(sql).toContain("reference_product_options_manage_admin");
    expect(sql).toContain("array['brand_admin']::public.app_role[]");
    expect(sql).not.toContain("bytea");
  });

  it("keeps buyer reads limited to active options of approved, visible products", () => {
    expect(sql).toContain("product.visible_to_buyers and product.review_status = 'approved' and reference_product_customization_options.is_active");
    expect(sql).toContain("PRODUCT_OPTION_SELECTION_NOT_ALLOWED");
    expect(sql).toContain("PRODUCT_OPTION_SELECTION_REQUIRED");
  });

  it("records validated selections as immutable order metadata through a separate protected RPC", () => {
    expect(sql).toContain("product_option_selections jsonb");
    expect(sql).toContain("submit_reference_product_order_with_options");
    expect(sql).toContain("ORDER_OPTION_SELECTIONS_IMMUTABLE");
    expect(sql).toContain("REFERENCE_PRODUCT_NOT_BUYER_VISIBLE");
  });
});
