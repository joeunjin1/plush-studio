import { describe, expect, it } from "vitest";
import {
  catalogPhotoPublicationPath,
  fiveRequiredPhotoIntakes,
  type ReferenceProductPhotoIntakeRow,
} from "./referenceProductPhotoPublication";

const rows: ReferenceProductPhotoIntakeRow[] = ["front", "left", "rear", "right", "top"].map(view => ({
  id: `${view}-id`,
  reference_product_id: "product-id",
  view_key: view as ReferenceProductPhotoIntakeRow["view_key"],
  source_storage_bucket: "plush-studio",
  source_storage_path: `org/reference-products/product/images/${view}/source.webp`,
  original_filename: `${view} source.webp`,
  mime_type: "image/webp",
  review_state: "draft",
}));

describe("reference product photo publication", () => {
  it("requires exactly the buyer-facing five views and keeps detail out of that gate", () => {
    expect(fiveRequiredPhotoIntakes(rows)).toHaveLength(5);
    expect(fiveRequiredPhotoIntakes(rows.slice(0, 4))).toBeNull();
    expect(fiveRequiredPhotoIntakes([...rows, { ...rows[0], id: "detail-id", view_key: "detail" }])).toHaveLength(5);
  });

  it("uses an organization-scoped public catalog path without source paths", () => {
    expect(catalogPhotoPublicationPath("org-id", "product-id", rows[0]))
      .toBe("org-id/reference-products/product-id/images/front/front-id-front-source.webp");
  });
});
