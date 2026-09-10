import { describe, expect, it } from "vitest";
import publicationSql from "../../../supabase/migrations/202609100016_reference_product_photo_publication.sql?raw";

describe("reference product photo publication migration", () => {
  it("publishes only five required reviewed photo copies from the public catalog", () => {
    expect(publicationSql).toContain("REFERENCE_PRODUCT_FIVE_APPROVED_VIEWS_REQUIRED");
    expect(publicationSql).toContain("REFERENCE_PRODUCT_REVIEWED_INTAKES_REQUIRED");
    expect(publicationSql).toContain("REFERENCE_PRODUCT_PUBLIC_CATALOG_OBJECTS_REQUIRED");
    expect(publicationSql).toContain("REFERENCE_PRODUCT_PERSONALIZATION_METHOD_REQUIRED");
    expect(publicationSql).toContain("view_key in ('front', 'left', 'rear', 'right', 'top')");
    expect(publicationSql).toContain("bucket_id = 'plush-studio-catalog'");
  });

  it("keeps private sources separate and requires brand-admin execution", () => {
    expect(publicationSql).toContain("public.reference_product_image_intakes");
    expect(publicationSql).toContain("plush-studio-catalog");
    expect(publicationSql).toContain("REFERENCE_PRODUCT_ADMIN_REQUIRED");
    expect(publicationSql).toContain("revoke all on function public.publish_reviewed_reference_product_photos");
    expect(publicationSql).toContain("grant execute on function public.publish_reviewed_reference_product_photos");
    expect(publicationSql).not.toContain("to anon;");
  });
});
