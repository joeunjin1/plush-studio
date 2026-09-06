# Plush Studio QA Verification

## 2026-09-06 — Buyer access and staging deployment

GitHub staging commit `ef192b5` was detected by Vercel as a Preview deployment. The immutable deployment URL is `https://plush-studio-9svqzic8g-joeunjin1s-projects.vercel.app`. The browser navigation reached the page title `Plush Studio · 나만의 인형 만들기`; however, interactive artifact collection then failed because the connected browser navigated to a different `chrome-extension://` context. This is a browser-automation collection limitation, not sufficient evidence of an application failure.

The verified replacement staging commit `ccaee57` is Ready at `https://plush-studio-apzez7k4q-joeunjin1s-projects.vercel.app`. A Vercel-authenticated browser loaded the title `Plush Studio · 나만의 인형 만들기`, while unauthenticated HTTP returned the Vercel login page. A repeated interactive artifact collection was again diverted to a `chrome-extension://` context; this prevents automated in-browser UAT but does not indicate an application runtime error.

Before release approval, rerun the buyer trial QA from a normal browser tab and verify: anonymous 3D editing is usable; a protected action opens the email gate; no download or cloud write occurs before authentication; a verified user returns to the same design; and a permitted export writes a `buyer_download_events` metadata row only in the selected environment.

## 2026-09-06 — Narrow mobile layout

The Basic Bear Atelier entry screen was visually checked at a 320 × 720 viewport. The top navigation labels remained on one line, the headline rendered as a readable Korean word group without clipping, the local-work action moved below the description, and the 3D preview remained the next primary content panel. The title uses `word-break: keep-all` without `white-space: nowrap`, so it can wrap at word boundaries rather than overflow at smaller widths.
