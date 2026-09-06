import { describe, expect, it } from "vitest";

const requiredKeys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function getRequiredEnv(key: (typeof requiredKeys)[number]) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getProjectUrl() {
  return getRequiredEnv("VITE_SUPABASE_URL")
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "");
}

async function verifyApiKey(apiKey: string) {
  const baseUrl = getProjectUrl();
  const response = await fetch(`${baseUrl}/rest/v1/organizations?select=id&limit=1`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  return response.status;
}

describe("Supabase production connection", () => {
  it("has all required connection settings without exposing values", () => {
    requiredKeys.forEach(key => {
      expect(getRequiredEnv(key).length).toBeGreaterThan(0);
    });

    expect(getProjectUrl()).toBe(
      "https://lzrjjfjpatcwsxhjafpy.supabase.co",
    );
  });

  it("accepts the anonymous key for RLS-protected REST access", async () => {
    await expect(verifyApiKey(getRequiredEnv("VITE_SUPABASE_ANON_KEY"))).resolves.toBe(200);
  });

  it("accepts the server-only service key for protected operations", async () => {
    await expect(verifyApiKey(getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"))).resolves.toBe(200);
  });
});
