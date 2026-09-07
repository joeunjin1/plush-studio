import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/202609070012_reference_product_models.sql", import.meta.url),
  "utf8"
);

describe("reference product model registration migration", () => {
  it("keeps owner GLB source bytes in private storage and metadata in the database", () => {
    expect(migration).toContain("source_storage_bucket text not null default 'plush-studio'");
    expect(migration).toContain("source_storage_path text not null unique");
    expect(migration).toContain("checksum_sha256 text not null");
    expect(migration).not.toMatch(/\b(bytea|blob)\b/i);
  });

  it("blocks duplicate model versions and multiple current versions for one product", () => {
    expect(migration).toContain("unique (reference_product_id, model_version)");
    expect(migration).toContain("reference_product_models_one_current_idx");
    expect(migration).toContain("where is_current");
  });

  it("requires approved and checksum-verified metadata before buyer publication", () => {
    expect(migration).toContain("checksum_verification_state = 'verified'");
    expect(migration).toContain("review_state = 'approved'");
    expect(migration).toContain("published_storage_bucket = 'plush-studio-catalog'");
    expect(migration).toContain("publish_reference_product_model");
  });

  it("uses scalar fields for the multi-item publication lookup", () => {
    expect(migration).toContain("target_reference_product_id,");
    expect(migration).not.toContain("selected_model,\n    target_organization_id");
    expect(migration).toContain("returning * into selected_model");
  });

  it("can be retried safely after a SQL-editor partial execution", () => {
    expect(migration).toContain('drop policy if exists "reference_product_models_read_current_public_or_admin"');
    expect(migration).toContain('drop policy if exists "reference_product_models_insert_admin"');
    expect(migration).toContain('drop trigger if exists set_reference_product_models_updated_at');
  });
});
