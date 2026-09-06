import { describe, expect, it } from "vitest";

describe("GitHub plush-studio deployment token", () => {
  it("has access to the intended repository without exposing the token", async () => {
    const token = process.env.GITHUB_TOKEN;
    expect(token?.length ?? 0).toBeGreaterThan(20);

    const response = await fetch("https://api.github.com/repos/joeunjin1/plush-studio", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    expect(response.status).toBe(200);
    const repository = await response.json() as { full_name?: string; permissions?: { push?: boolean } };
    expect(repository.full_name).toBe("joeunjin1/plush-studio");
    expect(repository.permissions?.push).toBe(true);
  });
});
