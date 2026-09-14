import { describe, expect, it } from "vitest";
import sql from "../../../supabase/migrations/202609120019_reference_product_customization_option_creator_guard.sql?raw";

describe("reference product customization option creator guard migration", () => {
  it("fills the administrator creator from the authenticated session on first save", () => {
    expect(sql).toContain("alter column created_by set default auth.uid()");
  });

  it("prevents later reassignment of the original administrator", () => {
    expect(sql).toContain("REFERENCE_PRODUCT_OPTION_CREATOR_IMMUTABLE");
    expect(sql).toContain("before update");
    expect(sql).toContain("reference_product_customization_options_creator_immutable");
  });

  it("does not alter buyer artwork, catalog assets, or existing orders", () => {
    expect(sql).not.toContain("delete from");
    expect(sql).not.toContain("buyer-personalization-assets");
    expect(sql).not.toContain("reference_product_order_requests");
  });
});
