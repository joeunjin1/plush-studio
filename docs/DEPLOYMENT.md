# Plush Studio — Deployment and Environment Runbook

## System ownership

`plush-studio` is maintained in the GitHub repository `joeunjin1/plush-studio`, the Supabase project reference `lzrjjfjpatcwsxhjafpy` in Seoul, and a same-name Vercel project. GitHub is the release source, Supabase is the production system of record, and Vercel provides Preview and Production deployments.

## Environment mapping

| Environment | Git branch | Vercel environment | Supabase target | Purpose |
|---|---|---|---|---|
| Development | local feature branch | Development | local or a dedicated development Supabase project | Feature implementation and isolated testing. |
| Preview | pull request branch | Preview | a dedicated staging Supabase project | Design review, authentication verification, and migration rehearsal. |
| Production | `main` | Production | `plush-studio` (`lzrjjfjpatcwsxhjafpy`) | Authorized brand, designer, factory, and QC work. |

> Preview must not point to the Production Supabase project once external users can sign in. This separation prevents test assets, test email links, and test write operations from entering manufacturing records.

## Vercel variables

Vercel needs the following variables in **Development**, **Preview**, and **Production**. The first two values are public browser configuration values and the final value is server-only. Never commit any value to Git or paste it in a ticket.

| Variable | Exposure | Meaning |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser-safe | Project base URL only, such as `https://<project-ref>.supabase.co`. The client normalizes an accidentally pasted `/rest/v1/` suffix. |
| `VITE_SUPABASE_ANON_KEY` | Browser-safe, RLS-bound | Supabase Publishable or legacy anon key. RLS must remain enabled for every public table. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Secret key for privileged scheduled or operational functions. It must not be prefixed with `VITE_` and is not used by the browser bundle. |

## Database migration sequence

Run migrations in the Supabase SQL Editor in lexical filename order. Copy every applied SQL file into the repository before production deployment so that the database history can be reconstructed.

| Order | File | Status | Purpose |
|---|---|---|---|
| 1 | `202609060001_plush_studio_foundation.sql` | Applied manually | Creates the role-aware collaboration schema, RLS policies, private bucket, audit events, and initial functions. |
| 2 | `202609060002_add_part_material.sql` | Applied and API-verified | Adds the factory-facing material field used by the cloud-save feature. |

The read-only foundation verification executed successfully after migration application. It confirms all 21 required collaboration tables, the private `plush-studio` asset bucket, and these secured API RPC functions: `is_org_member`, `has_org_role`, `can_view_project`, `can_edit_project`, `can_manage_project`, `can_contribute_to_project`, `can_inspect_project`, and `is_bucket_path_member`.

## Production release checklist

1. Apply pending SQL to the target Supabase project and confirm `Success` in SQL Editor.
2. Confirm RLS is enabled for every `public` table and the `plush-studio` storage bucket is private.
3. Run `pnpm test`, `pnpm check`, and `pnpm build` locally or in CI.
4. Push the verified commit to the intended GitHub branch.
5. Import `joeunjin1/plush-studio` as the Vercel project named `plush-studio`, retain the `Other` preset, and use the repository `vercel.json` (`pnpm build`, `dist/public`) before adding environment variables. Confirm a Preview deployment before promoting `main`.
6. Enable Vercel Analytics and Speed Insights. Configure Sentry separately with its server and browser DSNs before public onboarding.
7. Test a role-specific login, a project save, asset upload, Tech Pack download, and unauthorised project access.

## 2026-09-06 release record

The Vercel project **`plush-studio`** was created from `joeunjin1/plush-studio` with the `Other` preset. Its first deployment completed successfully from GitHub commit `6df2c4d` (`chore: preserve legacy 3d studio source`). Its stable production URL is `https://plush-studio.vercel.app` and its immutable first deployment URL is `https://plush-studio-40pvo3jqf-joeunjin1s-projects.vercel.app`.

GitHub commit `4497954` (`fix: align default BOM with 3d plush assembly`) then passed automatically through Vercel Production deployment and is live on the stable production URL. The live page was manually checked for loading, 3D basic-form selection, and the rule-based cost simulator; the initial BOM now includes eight 3D assembly components and produces the matching baseline target price of KRW 7,600.

GitHub `main` checkpoint `987ea81` is deployed through Vercel at `https://plush-studio-3k34x9e7i-joeunjin1s-projects.vercel.app`. The Product Atelier is available at `/#atelier`; the root URL intentionally remains the original public plush configurator landing experience. The deployed Atelier was checked for the new template system, parameter-aware 3D preview, materials, Design Readiness, and Design Proof controls.
