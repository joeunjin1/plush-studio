import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./atelier.css", import.meta.url), "utf8");

describe("Atelier narrow-mobile header contract", () => {
  it("keeps navigation compact and lets the Korean title wrap without a forced single line", () => {
    expect(styles).toContain("@media (max-width: 22.5rem)");
    expect(styles).toMatch(/\.at-header\s*\{\s*gap: 0\.375rem;\s*padding: 0\.875rem 1rem;/);
    expect(styles).toMatch(/\.at-title\s*\{\s*align-items: flex-start;\s*flex-direction: column;/);
    expect(styles).toMatch(/\.at-title h1\s*\{\s*overflow-wrap: normal;\s*word-break: keep-all;/);
    expect(styles).not.toMatch(/\.at-title h1\s*\{[^}]*white-space:\s*nowrap/);
    expect(styles).toMatch(/\.at-layout > aside\s*\{\s*position: static;\s*order: -1;/);
    expect(styles).toMatch(/\.at-webgl,\s*\.at-preview > svg\s*\{\s*height: 19rem;\s*width: 100%;/);
  });
});
