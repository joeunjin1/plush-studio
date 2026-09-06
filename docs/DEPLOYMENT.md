# Plush Studio — Deployment and Environment Runbook

## System ownership

`plush-studio` is maintained in the GitHub repository `joeunjin1/plush-studio`, the Supabase project reference `lzrjjfjpatcwsxhjafpy` in Seoul, and a same-name Vercel project. GitHub is the release source, Supabase is the production system of record, and Vercel provides Preview and Production deployments.

## Environment mapping

| Environment | Git branch | Vercel environment | Supabase target | Purpose |
|---|---|---|---|---|
| Development | local feature branch | Development | local or a dedicated development Supabase project | Feature implementation and isolated testing. |
| Preview | pull request branch | Preview | a dedicated staging Supabase project | Design review, authentication verification, and migration rehearsal. |
| Production | `main` | Production | `plush-studio` (`lzrjjfjpatcwsxhjafpy`) | Authorized brand, designer, factory, and QC work. |

The `staging` Git branch is created and pushed from the validated baseline. Vercel now has browser-safe Config (not Secret) pairs for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: the Production pair targets `plush-studio`; the Preview pair targets `plush-studio-staging`. The Preview pair is restricted to the `staging` preview branch and does not alter the Production values.

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
| 5 | `202609060005_customer_request_lifecycle.sql` | Applied manually | Adds staff-only sequential lifecycle transitions and protected transition notes for customer requests. |
| 6 | `202609060006_expose_customer_request_lifecycle_rpc.sql` | Applied and API-verified | Exposes the guarded lifecycle RPC in the Data API public schema for the operator UI. |

The read-only foundation verification executed successfully after migration application. It confirms all 21 required collaboration tables, the private `plush-studio` asset bucket, and these secured API RPC functions: `is_org_member`, `has_org_role`, `can_view_project`, `can_edit_project`, `can_manage_project`, `can_contribute_to_project`, `can_inspect_project`, and `is_bucket_path_member`.

After applying migration 005, use the staff-only `transition_customer_request` RPC rather than direct status updates. It permits only `received → reviewing → quoted → confirmed → sample_review → production_qa → completed`, with `closed` as the controlled exit from an active stage, and records a transition note in the request event log.

The public RPC endpoint and `transition_note` column were read-only verified after migration 006. Before customer onboarding, run a role-based UAT with a designated `customer_request_staff` account to confirm a real operator can advance an eligible request and that a non-staff authenticated user receives `FORBIDDEN`.

## Staging setup status

The approved **`plush-studio-staging`** project is created under the `DesignToGoods` organization with project ref `trhhgmionyyfnbwhxenn`, URL `https://trhhgmionyyfnbwhxenn.supabase.co`, `MICRO`, and `Northeast Asia (Seoul) · ap-northeast-2`. It is healthy, contains no Production data, and has the six version-controlled migrations applied. The database password is not recorded in this repository.

### Vercel public-variable constraint

Variables prefixed with `VITE_` are compiled into the browser bundle by Vite. Vercel therefore requires them to use **Config** visibility, not **Secret** visibility. Existing secret values cannot be converted in place: delete and recreate each of `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Config values. Use one Production-scoped pair for `lzrjjfjpatcwsxhjafpy` and one Preview-scoped pair for `trhhgmionyyfnbwhxenn`. Publishable keys are permitted in these browser values; service-role keys and database passwords must never be added to Vercel.

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

GitHub commit `9cdb709` (`feat: add BOM specs and guarded request lifecycle`) triggered the next Production deployment at `https://plush-studio-roc3n9ar6-joeunjin1s-projects.vercel.app`. The deployment URL responded with the public Plush Studio page during the Vercel build-status check. The status should be recorded as Ready only after the project deployment list completes its final refresh; the URL is retained here as the immutable build target.

Vercel Preview deployment `9d5rB3wwa3Yq8zDWUtxzkgYtZrk5` completed successfully with the Preview environment. It exposes `https://plush-studio-git-main-joeunjin1s-projects.vercel.app` and `https://plush-studio-m8cbtrfee-joeunjin1s-projects.vercel.app`. A final Preview deployment should be triggered from the `staging` branch after its next code change so the source label confirms `staging` before release approval.
