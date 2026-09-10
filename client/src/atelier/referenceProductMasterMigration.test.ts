import { describe, expect, it } from "vitest";
import sql from "../../../supabase/migrations/202609100015_reference_product_master_intake.sql?raw";

describe("reference product master intake migration", () => {
  it("keeps original five-view files in private Storage and records metadata only", () => {
    expect(sql).toContain("reference_product_image_intakes");
    expect(sql).toContain("source_storage_bucket text not null default 'plush-studio'");
    expect(sql).toContain("source_storage_path text not null unique");
    expect(sql).toContain("byte_size bigint not null");
    expect(sql).not.toMatch(/bytea|blob|binary\s+data/i);
  });

  it("requires complete reviewed metadata and exactly five active views before buyer publication", () => {
    expect(sql).toContain("title_en");
    expect(sql).toContain("category_code");
    expect(sql).toContain("carton_width_cm is null");
    expect(sql).toContain("carton_height_cm is null");
    expect(sql).toContain("carton_depth_cm is null");
    expect(sql).toContain("reference_product_has_five_active_views");
    expect(sql).toContain("REFERENCE_PRODUCT_FIVE_APPROVED_VIEWS_REQUIRED");
    expect(sql).toContain("REFERENCE_PRODUCT_PUBLICATION_METADATA_INCOMPLETE");
  });

  it("limits intake metadata access to the product organization brand_admin", () => {
    expect(sql).toContain('"reference_image_intakes_read_admin"');
    expect(sql).toContain("array['brand_admin']::public.app_role[]");
    expect(sql).toContain("enable row level security");
  });
});
