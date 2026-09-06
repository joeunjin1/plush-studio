import { describe, expect, it } from "vitest";
import { createProjectFromTemplate, projectSchema } from "./project";

describe("Atelier BOM part fields", () => {
  it("creates editable fabric, trim, process, and tolerance specifications for every template part", () => {
    const project = createProjectFromTemplate("bear");
    expect(project.parts).not.toHaveLength(0);
    expect(project.parts.every(part => part.fabric === "원단 지정" && part.process === "봉제" && part.toleranceMm === 2)).toBe(true);
  });

  it("hydrates legacy part records with safe BOM defaults", () => {
    const project = createProjectFromTemplate("bear");
    const legacy = {
      ...project,
      parts: project.parts.map(({ fabric, trims, process, toleranceMm, ...part }) => part),
    };
    const parsed = projectSchema.parse(legacy);
    expect(parsed.parts[0]).toMatchObject({ fabric: "", trims: "", process: "봉제", toleranceMm: 2 });
  });
});
