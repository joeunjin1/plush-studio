# Plush Studio QA Verification

## 2026-09-06 — Buyer access and staging deployment

GitHub staging commit `ef192b5` was detected by Vercel as a Preview deployment. The immutable deployment URL is `https://plush-studio-9svqzic8g-joeunjin1s-projects.vercel.app`. The browser navigation reached the page title `Plush Studio · 나만의 인형 만들기`; however, interactive artifact collection then failed because the connected browser navigated to a different `chrome-extension://` context. This is a browser-automation collection limitation, not sufficient evidence of an application failure.

The verified replacement staging commit `ccaee57` is Ready at `https://plush-studio-apzez7k4q-joeunjin1s-projects.vercel.app`. A Vercel-authenticated browser loaded the title `Plush Studio · 나만의 인형 만들기`, while unauthenticated HTTP returned the Vercel login page. A repeated interactive artifact collection was again diverted to a `chrome-extension://` context; this prevents automated in-browser UAT but does not indicate an application runtime error.

## 2026-09-06 — Product Atelier preview readability

The desktop review at 1536 × 864 confirmed the Basic Bear's complete silhouette now remains inside the WebGL frame with visible margin, while the editor remains readable beside it. The viewing instruction is separated into a compact guidance panel, the fidelity limitation is collapsed by default, and the export actions no longer compete with the canvas for visual attention. The mobile review at 390 × 844 retained preview-first ordering and showed the whole Basic Bear without clipping. This is a readability improvement for the procedural prototype, not evidence of a factory-validated digital twin.

The follow-up desktop review confirmed the Basic Bear's primary body is centered in the preview canvas rather than shifted toward the right edge. The camera now targets the primary body while calculating sufficient padded space for all accessory geometry; panning is disabled to preserve that stable framing. A mobile review at 390 × 844 retained an unclipped, centered product with preview-first ordering.

Before release approval, rerun the buyer trial QA from a normal browser tab and verify: anonymous 3D editing is usable; a protected action opens the email gate; no download or cloud write occurs before authentication; a verified user returns to the same design; and a permitted export writes a `buyer_download_events` metadata row only in the selected environment.

## 2026-09-06 — Narrow mobile layout

The Basic Bear Atelier entry screen was visually checked at a 320 × 720 viewport. The top navigation labels remained on one line, the headline rendered as a readable Korean word group without clipping, the local-work action moved below the description, and the 3D preview remained the next primary content panel. The title uses `word-break: keep-all` without `white-space: nowrap`, so it can wrap at word boundaries rather than overflow at smaller widths.
