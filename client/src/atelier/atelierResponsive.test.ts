import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./atelier.css", import.meta.url), "utf8");

describe("Atelier workspace mobile contract", () => {
  it("keeps compact navigation while prioritizing the product preview and a drawer sidebar", () => {
    expect(styles).toContain("@media (max-width: 22.5rem)");
    expect(styles).toMatch(/\.at-header\s*\{\s*gap: 0\.375rem;\s*padding: 0\.875rem 1rem;/);
    expect(styles).toMatch(/\.at-workspace-sidebar\s*\{\s*box-shadow:[\s\S]*?position: fixed;/);
    expect(styles).toMatch(/\.at-workspace-sidebar\[data-open="true"\]\s*\{\s*transform: translateX\(0\);/);
    expect(styles).toMatch(/\.at-workspace-stage \.(?:at-webgl)\s*,\s*\.at-preview > svg\s*\{\s*height: 19rem;\s*width: 100%;/);
    expect(styles).toMatch(/\.at-mobile-sidebar-toggle\s*\{\s*display: inline-flex !important;/);
  });
});
