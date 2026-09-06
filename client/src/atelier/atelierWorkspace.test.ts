import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Atelier.tsx", import.meta.url), "utf8");

describe("Product Atelier workspace shell", () => {
  it("prioritizes a sidebar workflow and a dedicated central product stage", () => {
    expect(source).toContain('className="at-workspace-sidebar"');
    expect(source).toContain('className="at-workspace-stage"');
    expect(source).not.toContain('className="at-title"');
    expect(source).toMatch(
      /className="at-workspace-sidebar"[\s\S]*?className="at-toolbar"/
    );
  });

  it("keeps an accessible mobile entry point to the editing drawer", () => {
    expect(source).toContain('aria-controls="atelier-controls"');
    expect(source).toContain('aria-expanded={sidebarOpen}');
    expect(source).toContain('className="at-mobile-sidebar-toggle"');
  });
});
