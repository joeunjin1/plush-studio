# 2026-09-12 시각 검토 메모

## 확인된 상태

데스크톱 buyer 화면은 따뜻한 아이보리·세이지·포레스트 그린 톤, 좌측 상품 문맥, 중앙의 큰 기준 상품 이미지로 구성되어 있다. 베르니즈 기준상품의 5면 프리뷰, 개인화 방식, 주문 단계가 한 화면 흐름 안에서 확인되었다. 로그인 전 관리자 화면은 brand_admin Magic Link 전용 상태로 표시되며 private 등록 UI가 노출되지 않았다.

기본 URL 진입은 이제 자유 3D 템플릿이 아니라 첫 공식 기준상품의 5면 프리뷰와 개인화·주문 패널로 연결된다. 상단 설명과 좌측 카탈로그도 실물 기준 상품과 공장 검토 경계를 명시한다.

390px 모바일 폭에서는 상단 정보, 5면 사진, 개인화 방식, 주문 단계가 한 열로 재배치되어 잘려 보이지 않았다. 기준 상품 사진과 선택 버튼이 우선 노출되었고, 주문 단계는 제품 정보 뒤로 이어졌다. 실제 보냉백 SKU의 색상 버튼과 로고 파일 선택은 아직 DB 데이터가 없으므로 그 등록 후 별도로 검증한다.

## staging 대상 확인

2026-09-14에 사용자 연결 Supabase 화면의 프로젝트 식별자는 `plush-studio-staging`이며 URL ref는 `trhhgmionyyfnbwhxenn`으로 확인했다. 화면의 `main · PRODUCTION` 표기는 해당 Supabase 프로젝트의 branch label이므로, 이 확인만으로 Production 프로젝트 DB로 변경이 전파되지는 않는다. 단, 이후의 수동 SQL은 항상 이 staging project ref에서만 실행하고 Production Supabase 프로젝트에서는 실행하지 않는다.

2026-09-14 staging Preview alias를 읽기 전용으로 열었을 때 페이지 title은 이전 `Plush Studio · 나만의 인형 만들기`로 표시되었다. 새 체크포인트의 공식 상품 주문 UI가 이 alias에 도달했는지는 브라우저 artifact 수집 오류로 화면 텍스트까지 확정하지 못했다. 관리자 UAT 전 staging Preview deployment 상태를 다시 확인한다.

2026-09-14 자동 게시 staging 도메인의 `#catalog-admin`은 private 관리자 로그인 화면까지 정상 표시되었다. 사용자 승인으로 `gjtrade@naver.com`에 Magic Link 전송을 시작했으며, 인증 완료 후 SKU 색상 규칙의 최초 저장·재저장을 검증한다.

사용자 인증 완료 후에도 자동 게시 staging 도메인의 원래 관리자 탭은 비인증 상태로 남아 있었다. 브라우저 기록에는 별도의 `https://plush-studio.vercel.app/#` 진입이 보여, Magic Link가 staging 관리자 탭과 다른 배포 origin으로 돌아갔을 가능성을 우선 점검한다. Supabase client 자체는 세션 영속화와 자동 갱신을 비활성화하지 않았으므로, Auth 설정 변경 전에 redirect origin과 callback 복귀 상태부터 확인한다.

staging Supabase Auth URL 설정에서 Site URL은 Vercel staging alias이고, Redirect URLs에도 그 alias와 과거 immutable Preview만 등록되어 있었다. 현재 자동 게시 domain `https://plushstudio-hpnrzrs8.manus.space`는 allowlist에 없어, 이 domain에서 요청한 Magic Link가 Site URL로 fallback할 수 있다. 관리자 재인증을 줄이기 위한 최소 수정은 해당 domain의 catalog-admin callback URL을 staging allowlist에 추가하는 것이다. Site URL, Production Auth, roles, passwords는 변경하지 않는다.

사용자 승인 후 `https://plushstudio-hpnrzrs8.manus.space/?plush_admin_return=catalog-admin`를 staging Auth Redirect URLs에 추가했다. Supabase 화면은 `Successfully added 1 URL`과 총 9개 allowlisted URL을 표시했다. Site URL은 변경하지 않았으며, Production Supabase Auth·Storage·roles·계정은 변경하지 않았다.

추가된 allowlist를 검증하기 위해 같은 자동 게시 staging domain의 `#catalog-admin`에서 brand_admin Magic Link를 새로 요청했다. 발송 완료 후 이메일의 새 링크가 동일 domain의 `#catalog-admin`으로 복귀하는지, 그리고 브라우저 세션이 재방문에도 유지되는지를 이어서 확인한다.

사용자 인증 완료 후 동일 staging domain을 새로 열어도 관리자 세션은 복원되지 않았다. 로컬 browser console/network logs에는 Supabase token 또는 session 오류가 기록되지 않았고, Gmail 연결도 이 관리자 이메일 계정의 인증 메일을 제공하지 않아 callback URL 원문을 비공개로 확인할 수 없었다. 이후 진단은 사용자가 새 Magic Link를 연 직후 주소창의 domain을 확인하거나, staging Auth audit log에서 redirect 결과를 확인하는 방식으로 진행한다.

staging Supabase Auth Audit Logs 설정은 별도 `audit_log_entries` DB 기록을 비활성화한 상태이며, 기존의 Auth logs를 볼 수 있는 링크만 제공한다. 디버깅 편의를 위해 추가 감사 로그 저장을 켜면 DB 저장량과 Auth 설정이 바뀌므로, 현재는 변경하지 않았다.

2026-09-14 빌드 산출물의 공개 Supabase URL을 확인한 결과 자동 게시 Manus domain은 Production ref `lzrjjfjpatcwsxhjafpy`를 가리킨다. 따라서 이 domain은 staging Magic Link·상품 등록·logo UAT의 대상이 아니며, browser로 테스트하지 않는다. GitHub `staging`에는 공식 상품몰 체크포인트 `edc394b`를 반영했다. 반면 Vercel staging alias는 현재 Vercel SSO로 보호되어 비로그인 HTTP 요청이 Login 페이지로 redirect되므로, Vercel 세션이 있는 browser에서만 배포·staging Auth를 검증한다.

Vercel 로그인 경로를 통해 staging alias를 다시 열었을 때 page title은 `Plush Studio · 실물 기준 커스텀 굿즈 상품몰`로 확인됐다. 즉 최신 공식 상품몰 커밋은 Vercel staging alias까지 도달했다. 다만 browser artifact collector가 Chrome extension URL에 접근할 수 없어 DOM·스크린샷은 반환하지 못했으며, 실제 관리자 UAT는 사용자의 로그인된 Vercel browser에서 이어서 수행해야 한다.

사용자가 제공한 SENKANG SQL은 데이터·테이블·RLS를 변경하지 않고 `public.buyer_sample_mall_list(text, integer, integer)` 함수와 `authenticated` 실행 권한만 만들거나 교체하는 내용이다. `plush-studio-staging` SQL Editor에서 `pg_proc`를 대상으로 동일 함수명을 조회한 결과는 0 rows였다. Editor는 빈 결과에 `Too small: expected string to have >=1 characters` UI 오류를 함께 표시했으므로, 실제 함수 부재는 별도의 단순 쿼리로 한 번 더 확인한 뒤 삭제 여부를 확정한다.

단순 `select 'staging-read-only-check' as result;`도 동일하게 0 rows와 `Too small: expected string to have >=1 characters`를 반환했다. 따라서 현재 SQL Editor UI 상태에서는 읽기 전용 쿼리 결과 자체가 신뢰되지 않으며, 기존 0 rows만으로 SENKANG 함수가 없다고 단정하지 않는다. 되돌리기는 함수 signature를 한정한 `DROP FUNCTION IF EXISTS`로만 설계하고, 사용자가 명시 승인한 뒤 staging에서 실행한다.

사용자 승인 후 staging SQL Editor에서 `revoke all on function public.buyer_sample_mall_list(text, integer, integer)` 및 `drop function if exists public.buyer_sample_mall_list(text, integer, integer)`가 포함된 트랜잭션을 실행했고 `Success · No rows returned` 결과를 확인했다. 삭제 대상은 SENKANG RPC 1개와 그 execute grant뿐이며, `CASCADE`는 사용하지 않았다. 테이블·행·Storage·RLS·Auth·roles·Production 변경은 없다.

2026-09-14 프로젝트 경계 재점검 결과: 작업 디렉터리는 `/home/ubuntu/plush-studio`, GitHub repository는 `joeunjin1/plush-studio`, 최신 staging commit은 `edc394b7e29ca5db56197d3d81df777d09bad1d4`이며 GitHub `staging` 브랜치도 동일 커밋을 가리킨다. Vercel의 올바른 프로젝트는 `joeunjin1's projects / plush-studio`이고, 기존에 보인 `senkang-buyer-storefront` 화면은 본 작업과 무관하다. 이후 브라우저·배포·DB UAT는 이 세 식별자와 staging Supabase ref `trhhgmionyyfnbwhxenn`만 사용한다.

Vercel `joeunjin1's projects / plush-studio / Deployments`에서 `edc394b` staging Preview가 Ready로 확인됐고 immutable Preview URL은 `https://plush-studio-4ttgycfvh-joeunjin1s-projects.vercel.app`이다. 이 주소의 `#catalog-admin`도 열었으나 browser artifact collector가 Chrome extension URL 제한으로 DOM을 반환하지 못했다. 이후 immutable Preview 검증은 사용자 브라우저 화면 확인 또는 Vercel UI의 Deployment 상태와 페이지 title을 함께 사용한다.

Vercel `plush-studio / Environment Variables`에서 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 Preview와 Production에 별도로 존재하는 것을 확인했다. Preview URL 항목은 `staging` branch에 적용됨을 표시했고 값은 공개하지 않았다. 이로써 Vercel staging Preview만 staging Supabase 검증 대상이며, auto-published Manus domain과 Production `plush-studio.vercel.app`은 이 UAT에서 제외한다.

stable staging alias `https://plush-studio-git-staging-joeunjin1s-projects.vercel.app/#catalog-admin`는 최신 title `Plush Studio · 실물 기준 커스텀 굿즈 상품몰`을 반환했다. 그러나 해당 브라우저의 artifact collector는 Chrome extension URL 제한으로 관리자 UI DOM을 추출하지 못한다. 이후 이 alias의 Magic Link·brand_admin UI UAT는 사용자가 화면을 직접 열어 확인하거나 별도 정상 browser session에서 수행한다.

공식 실물 상품몰은 현재 기본 buyer 진입으로 전환됐다. 데스크톱과 390px 모바일에서 실물 기준 프리뷰 → SKU별 허용 사양 → 공장 검토 요청의 순서와 자유 3D 설계 보조 경로를 확인했다. 자유 설계 전용 백업 도구는 상품몰 첫 화면에서 숨겨 buyer의 상품 선택 흐름과 섞이지 않도록 했다.

## 후속 확인 필요

실제 부직포 보냉백 SKU가 staging DB에 등록되기 전에는 본체·손잡이 색상 패널의 로그인된 저장, DB-backed buyer 팔레트, 로고 업로드, mobile touch 흐름을 시각적으로 확정할 수 없다. 보냉백의 5면 원본 매핑과 migration 016/018 수동 적용이 완료된 뒤 desktop·mobile 실사용 UAT를 다시 수행한다.

## 디자인 기준

buyer와 관리자 화면은 실물 기준 상품 → SKU별 허용 사양 → 공장 검토 요청이라는 동일한 구조를 유지한다. 반복적인 범용 대시보드 카드보다 상품 증거·안전 영역·제작 경계를 우선하며, 색상·프린트 시뮬레이션은 생산 보증이 아닌 참고라는 문구를 유지한다.
