import { describe, expect, it } from "vitest";
import {
  buyerAccessPrompt,
  buyerDownloadAuditFailureMessage,
  buyerDownloadArtifactType,
  buyerEmailRedirectUrl,
  completeBuyerDownloadAudit,
} from "./buyerAccess";

describe("buyer email access boundary", () => {
  it("returns buyers to the exact product and editor route after email authentication", () => {
    const location = new URL("https://plush-studio.vercel.app/?template=tote#atelier") as unknown as Location;
    expect(buyerEmailRedirectUrl(location)).toBe("https://plush-studio.vercel.app/?template=tote#atelier");
  });

  it("explains that guest design remains local at a protected artifact boundary", () => {
    expect(buyerAccessPrompt("부위 분리 GLB")).toContain("이 기기");
  });

  it("maps every exportable buyer artifact to a constrained audit type", () => {
    expect(buyerDownloadArtifactType("완성 미리보기 PNG")).toBe("preview_png");
    expect(buyerDownloadArtifactType("Design Proof 3면 PNG")).toBe("proof_png_3view");
    expect(buyerDownloadArtifactType("부위 분리 GLB")).toBe("parted_glb");
    expect(buyerDownloadArtifactType("Design Proof PDF")).toBe("proof_pdf");
    expect(buyerDownloadArtifactType("Design Proof JSON")).toBe("proof_json");
    expect(buyerDownloadArtifactType("전체 백업 JSON")).toBe("full_backup_json");
  });

  it("treats an audit rejection as an explicit partial-success outcome", async () => {
    await expect(completeBuyerDownloadAudit(async () => undefined)).resolves.toEqual({
      recorded: true,
    });
    await expect(
      completeBuyerDownloadAudit(async () => {
        throw Error("RLS blocked insert");
      })
    ).resolves.toEqual({
      recorded: false,
      message: buyerDownloadAuditFailureMessage,
    });
  });
});
