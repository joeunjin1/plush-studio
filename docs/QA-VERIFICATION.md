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

## 2026-09-06 — Core product visual-quality pass

The desktop and 390 × 844 mobile reviews covered the Basic Bear, Tote Bag, and Regular T-shirt. The procedural Basic Bear now has a short-pile material impression, face and paw panels, and key seam guides. Core bag models use rounded padded panel geometry with construction seam lines, handles, closure, and pocket geometry. Core T-shirts use a defined shoulder and sleeve silhouette with collar, sleeve, and hem seam detail. All remain explicitly labelled as lightweight Concept/Prototype previews, not factory-validated 3D digital twins or substitute production patterns.

The extended core-product pass also visually checked Rabbit, Cat, Keyring, and Cushion template proportions at desktop size. Commit `2a10797` was deployed as the isolated staging Preview `https://plush-studio-7o0pr2xgt-joeunjin1s-projects.vercel.app`; Vercel reported Ready in 23 seconds. Automated validation passed with 22 test files, 62 passed tests, and 2 existing skips, followed by TypeScript and production-build success. The build still reports non-blocking large-chunk warnings for the existing Three.js and document-export bundles.

## 2026-09-06 — Product-first workspace shell

The desktop review at 1536 × 864 confirmed that the former hero and horizontal editing band no longer consume the primary workspace. The left column holds template, save, and step controls while the product stage occupies the dominant central area. The 390 × 844 mobile review showed the product first, with an explicit 44px edit trigger opening the control drawer instead of reducing the preview canvas. This layout change has local visual and automated validation only until the next staging Preview is reviewed.

## 2026-09-06 — Bernese memorial reference product

The supplied Bernese Mountain Dog five-view board was deterministically separated into front, left, rear, right, top, and both blank memorial-tag faces. The first local preview through a standalone Vite server returned SPA HTML for `/manus-storage/*` paths and therefore showed broken images. The Product Atelier development command was restored to the Express/Vite bridge, where the registered storage proxy returns a signed asset redirect before the SPA fallback. The 1536 × 864 review then confirmed that the official reference card and full front reference image load correctly. The product view remains expressly labelled as a view-locked photo-based virtual 3D preview, not a production-grade GLB digital twin.

At 1280 × 900, the stage showed the full front image with direct front/left/rear/right/top controls, a five-view auto-rotation control, and a separate blank tag preview below it. At 390 × 844, the product image remains the first large element, the five view controls form touch-safe two-column buttons, and the memorial-tag face selector, constrained text area, and tag preview stack without horizontal clipping.

The local 1280 × 900 product-mall review confirmed that the Bernese five-view product card appears as the dominant selectable catalog entry and leads to a second stage where the buyer sees the full reference image before choosing a registered personalization method. The product detail review confirmed two visible product-specific methods—memorial-tag text and brand-mark memorial tag—plus front/back tag-face selection. These screens are an interactive photo-based preview and production-review intake, not a claim that a personalized production file has been factory approved.

## 2026-09-06 — Staging catalog asset verification

After the `plush-studio-catalog` public bucket was created in staging, the owner uploaded all five Bernese reference views and both tag faces to the bucket root. Direct public checks returned HTTP 200 with `image/webp` content for each of the seven files. The frontend now derives the public catalog URL from its environment-specific `VITE_SUPABASE_URL`; local development retains the signed `/manus-storage` fallback. The next staging deploy must be checked in a browser before the same approved catalog assets are copied to Production.

## 2026-09-07 — Five-view correction and rotation experience

The initial rear/top crops were not suitable because adjacent source-board photos remained visible. The owner supplied independent final rear and top images to replace them. The photo-view UI now preloads reference images, crossfades only between adjacent selected states, uses a slower 2.4-second cadence, and renders a clear fallback message instead of a broken-image icon on failure. A separate user-controlled Bernese 3D concept mode supplies continuous orbit rotation for interaction testing; it is explicitly described as a lightweight concept, not an accurate GLB digital twin. Local desktop review verified the isolated front reference stage and its generous product framing before staging deployment.

The owner uploaded the final independent back and top photographs under the current file names `pasted_file_HSmHMI_image.png` and `pasted_file_mjsXem_image.png`. Direct staging public checks returned HTTP 200 and `image/png` for both files. The catalog source binding now maps those names only in the isolated staging Supabase environment; Production continues to use the reviewed canonical filenames when and if those final owner-approved files are later copied there.

## 2026-09-07 — Customer-preview accuracy safeguard

User review correctly found that the continuous Bernese concept model did not yet match the supplied product, despite providing a smooth interaction. The customer-facing `3D 컨셉 회전` control has therefore been removed. The catalog retains the verified five reference photographs with preloading and directional crossfades; the exploratory concept code is not exposed to buyers. A product-specific model must pass owner review against the supplied five views before any 3D rotation control is returned to the buyer-facing experience.

## 2026-09-07 — Owner-supplied Bernese GLB v02 staging UAT

The owner-supplied replacement source was stored only in the staging public catalog bucket at `bernese-memorial-plush/3d/berner_plush_360_v02.glb`. Read-only analysis identified one mesh, one material, one embedded texture, UV0 and normals, no animations, approximately 103,553 triangles, and a 6,547,424-byte source size. The remote object returned HTTP 200 with `model/gltf-binary`; its downloaded bytes match the owner source exactly with SHA-256 `eeebf4aba5861150ae0eca006cf85bb7d0583e7b9400c15ff60ac2106ac647d5`.

Commit `eb779a0` adds the versioned source mapping, dynamic `model-viewer` loading, drag/zoom and auto-rotation controls, loading feedback, and automatic fallback to the official five-view photographs on model-load failure. Automated validation passed with 34 test files, 94 passing tests, and 2 existing skips; TypeScript and production builds also passed. Vercel reported the `staging` Preview deployment successful.

The owner then visually verified the new staging 3D view and confirmed it was normal. This confirms staging viewer delivery of the supplied v02 source, not physical-product accuracy, factory/sample approval, or a production-grade digital-twin certification. The previous v01 object remains preserved for rollback. The v02 source is approximately 6.55 MB and 103k triangles, so mobile-network/device performance remains a pending measurement; five-view photos remain the first reference and error fallback. No Production storage object, Supabase migration, authentication setting, or `main` branch deployment was changed.
