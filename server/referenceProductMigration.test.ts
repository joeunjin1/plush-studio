import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/202609060008_reference_product_library.sql", import.meta.url),
  "utf8"
);

describe("reference product library migration", () => {
  it("creates SKU uniqueness and dimensional CBM without storing image bytes", () => {
    expect(migration).toContain("unique (organization_id, sku)");
    expect(migration).toContain("carton_cbm numeric(14,6) generated always as");
    expect(migration).toContain("reference_product_images");
    expect(migration).toContain("storage_path text not null unique");
    expect(migration).not.toMatch(/\bblob\b|\bbytea\b/i);
  });

  it("requires every customer-visible product to be reviewed and rights-confirmed", () => {
    expect(migration).toContain("visible_to_buyers boolean not null default false");
    expect(migration).toContain("review_status = 'approved'");
    expect(migration).toContain("rights_confirmed_at is not null");
  });

  it("models five product views and both replaceable memorial-tag faces", () => {
    expect(migration).toContain("'front', 'left', 'rear', 'right', 'top', 'detail'");
    expect(migration).toContain("side in ('front', 'back')");
    expect(migration).toContain("max_characters integer not null default 36");
  });
});
