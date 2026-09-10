# Official Product Order UAT — Staging

> **Scope:** This guide applies only to staging Supabase project `trhhgmionyyfnbwhxenn` and the `staging` GitHub branch. Do not run migration 013 or these test submissions in Production.

## Preconditions

The official-product order UI is deployed from staging commit `9f99728`. Before a request can persist, the owner must manually apply `supabase/migrations/202609100013_reference_product_order_requests.sql` to staging. The migration is additive: it adds a private `buyer-personalization-assets` bucket, the metadata-only `reference_product_order_requests` table, and an authenticated RPC. It does not change existing customer requests, public catalog assets, roles, or Auth configuration.

| Item | Expected staging condition | Fail-safe behavior |
|---|---|---|
| Buyer account | Authenticated using a fresh Magic Link | Final submit returns to the email gate; anonymous buyers cannot write a request. |
| Product | Bernese official source item | Product title, SKU, source version, and optional owner GLB v02 checksum are copied as metadata. |
| Personalization | Valid memorial-tag text or approved image type | Buyer cannot advance until a valid method and content have been selected. |
| Artwork | PNG, JPEG, or WebP within 5 MB | Original is placed in the private buyer bucket, not the public catalog or a database column. |
| Contact | Company name, contact name, consent; phone optional | Final submit remains disabled until required information is valid. |

## Desktop UAT

Open the staging buyer path below, select the Bernese product, and compare the front, left, rear, right, and top photographs before selecting a personalization method.

```text
https://plush-studio-git-staging-joeunjin1s-projects.vercel.app/?reference=bernese-memorial-plush-v01#atelier
```

First choose `교체형 기념택 문구`, enter a short text, choose the tag side, and select `개인화 방식 선택`. Confirm that the order panel appears below the official reference preview and summarizes the product, SKU, personalisation type, placement, and text without calling the preview a production-approved proof.

Then proceed through quantity and delivery date, request purpose, buyer contact, and consent. Use `이메일 인증 후 요청 보내기` when logged out. After the Magic Link returns, the product selection and typed draft should remain in the same session. Sign in and select the final button once. The expected result is a single request ID and a “request received” screen; it is not a payment or binding purchase confirmation.

## Mobile UAT

Use a phone or Chrome device viewport at 375 × 812. The five-view image remains the first visual content. Confirm that each view-control target is at least 44 px high, the order step buttons wrap into two columns, text/telephone inputs do not trigger unintended zoom, and the Next/Submit bar remains reachable above the bottom safe area. Test the tag side and one image-logo path separately.

| Test case | Pass condition |
|---|---|
| Initial preview | Official 5-view image is visible before order fields; the older procedural Bernese is not presented as the official source. |
| GLB mode | Owner-supplied v02 viewer loads only after selection; image fallback is available if it fails. |
| Draft return | Text, order amount, purpose, company, and contact values survive a successful same-origin Magic Link return. |
| Private logo | A test logo is not publicly accessible by URL; the request stores only its object key, name, MIME type, and byte count. |
| Duplicate retry | A second click or retry after a network interruption returns the first request ID rather than creating a duplicate. |
| Buyer isolation | A second authenticated test buyer cannot list or read the first buyer’s request or logo object. |

## Read-only staging verification

After one successful request, the owner can inspect only metadata with this staging SQL. Do not paste personal text, image bytes, tokens, or public URLs into shared reports.

```sql
select
  id,
  reference_product_sku,
  reference_product_version,
  model_version,
  personalization_profile_code,
  placement_label,
  quantity,
  desired_delivery_date,
  purpose,
  status,
  created_at
from public.reference_product_order_requests
order by created_at desc
limit 5;
```

The resulting record must have a buyer-company identifier, a `received` status, and no binary column. Do not alter `status` manually; lifecycle, quote, sample, and production states will be enabled through separate role/RLS UAT.

## Promotion boundary

Passing this guide validates only staging. Promotion requires a separate owner approval and a new Production run through: migration 013, bucket and policy verification, approved catalog assets, production Auth callback verification, one isolated buyer UAT, and a code merge from `staging` to `main`. The promotion checklist is maintained in `docs/STAGING-TO-PRODUCTION-PROMOTION.md`.
