# Infrastructure Status

## 2026-09-06 — Pre-provisioning check

The user is authenticated in Supabase. The available organization is **DesignToGoods** on the Pro plan and currently shows **10 projects**. The complete organization project list was inspected: `designtogoods`, `gashapon-boutique-prod`, `gjtrade-trade`, `jakshim3`, `keryx`, `lemonpack`, `puppet-studio`, `randomking`, `senkang-quote`, and `stocklot`. No existing `plush-studio` project exists, so the requested name will not collide with an existing project. The next action is to open the new-project form under the DesignToGoods organization.

The application workspace is initialized at `/home/ubuntu/plush-studio`. Its managed development database is separate from the requested Supabase production database and must not be treated as the system of record. Supabase must become the production system of record after its RLS policies, storage buckets, and environment variables are configured.

## 2026-09-06 — Creation approval

The new-project form is filled with the requested `plush-studio` name and Micro compute, which is displayed as approximately USD 10 per month. Before creation, the detected region was Americas and automatic exposure of new tables was enabled. The approved target configuration is AWS `ap-northeast-2` (Seoul), Data API enabled, automatic table exposure disabled, and automatic RLS enabled. The user explicitly confirmed this configuration and the paid project creation.

## 2026-09-06 — Supabase project created

The Supabase project is now created and healthy with the permanent project reference `lzrjjfjpatcwsxhjafpy`, project URL `https://lzrjjfjpatcwsxhjafpy.supabase.co`, and the requested **Northeast Asia (Seoul), ap-northeast-2** region. The project is on Micro compute. The SQL Editor has been opened under the production branch to apply the versioned `plush-studio` manufacturing-collaboration schema. The new project has no GitHub repository and no migrations connected yet; those items remain intentional setup tasks.

The initial migration is now staged in the Supabase SQL Editor but has not been run. It creates the manufacturing-collaboration data model, private asset bucket, RLS policy foundation, project-scoped role controls, audit events, and timestamp triggers. Execution is pending final user confirmation because it changes the production database.

## 2026-09-06 — Schema and connection verification

The initial SQL migration completed successfully in the Supabase production SQL Editor with no rows returned. The Supabase connection test also passed for the normalized plush-studio Project URL, the RLS-bound browser key, and the server-only secret key. The currently registered URL includes the `/rest/v1/` suffix, which the application connection layer must normalize before constructing API paths.

## 2026-09-06 — Vercel preflight

The user is authenticated in the Vercel Pro account `joeunjin1's projects`. No `plush-studio` project appeared in the visible project list. The pre-existing GitHub repository is `joeunjin1/plush-studio`; before connecting it to Vercel, the new full-stack source must be committed and pushed so Preview and Production deploy the intended application instead of the previous standalone static prototype.
