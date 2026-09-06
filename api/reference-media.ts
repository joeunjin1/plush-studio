type VercelRequest = {
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  end: (body?: string) => void;
  setHeader: (name: string, value: string) => void;
  statusCode: number;
};

function validStorageKey(key: string) {
  return (
    key.length > 0 &&
    key.length <= 240 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(key) &&
    !key.includes("..")
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const candidate = req.query?.asset;
  const asset = Array.isArray(candidate) ? candidate[0] : candidate;
  if (!asset || !validStorageKey(asset)) {
    res.statusCode = 400;
    res.end("Invalid reference asset path");
    return;
  }

  const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!apiUrl || !apiKey) {
    res.statusCode = 500;
    res.end("Reference media service is not configured");
    return;
  }

  try {
    const endpoint = new URL(
      "v1/storage/presign/get",
      `${apiUrl.replace(/\/+$/, "")}/`
    );
    endpoint.searchParams.set("path", asset);
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      res.statusCode = 502;
      res.end("Reference media is temporarily unavailable");
      return;
    }
    const payload = (await response.json()) as { url?: string };
    if (!payload.url) {
      res.statusCode = 502;
      res.end("Reference media URL is unavailable");
      return;
    }
    res.statusCode = 307;
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Location", payload.url);
    res.end();
  } catch {
    res.statusCode = 502;
    res.end("Reference media proxy failed");
  }
}
