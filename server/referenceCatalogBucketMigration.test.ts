import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202609060009_reference_catalog_public_bucket.sql",
    import.meta.url
  ),
  "utf8"
);

const glbMigration = readFileSync(
  new URL(
    "../supabase/migrations/202609070011_allow_catalog_glb.sql",
    import.meta.url
  ),
  "utf8"
);

describe("reference catalog public bucket migration", () => {
  it("creates a separately scoped public image bucket with an image-only size budget", () => {
    expect(migration).toContain("'plush-studio-catalog'");
    expect(migration).toContain("public, file_size_limit, allowed_mime_types");
    expect(migration).toContain("true,");
    expect(migration).toContain("10485760");
    expect(migration).toContain("'image/png', 'image/jpeg', 'image/webp'");
  });

  it("restricts catalog mutations to authenticated brand administrators", () => {
    expect(migration).toContain("function public.is_catalog_asset_admin");
    expect(migration).toContain("array['brand_admin']::public.app_role[]");
    expect(migration).toContain('"plush_studio_catalog_upload_admin"');
    expect(migration).toContain('"plush_studio_catalog_update_admin"');
    expect(migration).toContain('"plush_studio_catalog_delete_admin"');
  });

  it("documents that private buyer and factory assets remain outside the public catalog", () => {
    expect(migration).toContain("Buyer files, project assets, factory materials, and exports remain");
    expect(migration).toContain("private plush-studio bucket");
  });

  it("extends only the catalog bucket with the reviewed GLB MIME type", () => {
    expect(glbMigration).toContain("where id = 'plush-studio-catalog'");
    expect(glbMigration).toContain("'model/gltf-binary'");
    expect(glbMigration).toContain("'image/png'");
    expect(glbMigration).toContain("private plush-studio bucket");
  });
});
