import { describe, expect, it } from "vitest";

const stagingUrl = "https://trhhgmionyyfnbwhxenn.supabase.co";

describe("staging catalog service credential", () => {
  it("can read the staging public catalog bucket without exposing its secret", async () => {
    const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
    expect(key, "STAGING_SUPABASE_SERVICE_ROLE_KEY must be provided securely").toBeTruthy();

    const response = await fetch(`${stagingUrl}/storage/v1/bucket/plush-studio-catalog`, {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key!}`,
      },
    });
    expect(response.status).toBe(200);

    const bucket = (await response.json()) as { id?: string; public?: boolean };
    expect(bucket.id).toBe("plush-studio-catalog");
    expect(bucket.public).toBe(true);
  });
});
