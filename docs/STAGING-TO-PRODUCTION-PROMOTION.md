# Staging to Production Promotion Runbook

## Decision principle

`staging`에서 기능을 완성하고 반복 UAT를 마친 뒤 `main`으로 병합하는 방식은 맞습니다. 다만 GitHub에 저장되는 **코드**와 Supabase에 저장되는 **스키마·데이터·파일·Auth 설정**은 서로 다른 시스템입니다. 따라서 한 번의 Git 병합만으로 Production이 staging과 완전히 같아지지는 않습니다.

> Production 승격은 하나의 버튼이 아니라, 검증된 코드·비파괴 SQL·승인 자산·인증 복귀 URL을 같은 릴리스 번호로 정렬하는 통제된 절차입니다.

## What can and cannot merge together

| 대상 | staging에서 검증 | Production 반영 방법 | 자동 병합 여부 | 필수 확인 |
|---|---|---|---|---|
| React·TypeScript·스타일·테스트 | GitHub `staging` + Vercel Preview | `staging → main` Pull Request 병합 | 예 | commit SHA, `pnpm test`, `pnpm check`, `pnpm build` |
| Supabase SQL migration | staging SQL Editor | Production SQL Editor에서 같은 파일을 순서대로 수동 적용 | 아니오 | 성공 응답, RLS, 함수·인덱스 확인 |
| public catalog 사진·승인 GLB | staging catalog bucket | Production catalog bucket에 승인본을 버전 키로 별도 업로드 | 아니오 | bytes·SHA-256·MIME·HTTP 응답 |
| private buyer·원본 GLB 파일 | staging private bucket | Production에 필요한 승인본만 별도 수집 | 아니오 | 조직 경로·RLS·signed access |
| Supabase Auth Site/Redirect URL | staging Auth | Production Auth에서 production 도메인만 별도 확인 | 아니오 | Magic Link 복귀·만료 링크·로그아웃 |
| 테스트 주문·UAT 데이터 | staging | 원칙적으로 이동하지 않음 | 아니오 | Production 데이터 오염 여부 |

## Promotion gates

### Gate 1 — Staging completion

모든 기능은 `staging`에서 구현합니다. buyer와 brand_admin의 주요 흐름을 실제 이메일, 데스크톱, 모바일에서 테스트하고 다음 증거를 릴리스 노트에 남깁니다.

1. 공식 상품 5면 사진 및 대표 제공 GLB가 올바르게 렌더링되고, GLB 실패 시 사진으로 복귀한다.
2. 구매자는 로그인 없이 상품·개인화 방식을 탐색하며, 로그인은 저장·보호 다운로드·최종 요청에서만 요구된다.
3. 개인화 방식, 안전 영역, 텍스트·이미지 제약, 수량, 납기, 연락처 동의가 요청 요약에 정확히 표시된다.
4. brand_admin만 private 원본 GLB 초안을 올리고, 승인 전에는 어떤 buyer에게도 노출되지 않는다.
5. `pnpm test`, `pnpm check`, `pnpm build`, Preview 배포 상태가 모두 성공한다.

### Gate 2 — Promotion packet

Production 반영 전에 하나의 릴리스 패킷을 고정합니다. 패킷에는 staging commit SHA, 적용 대상 migration 파일 목록, public catalog object key·SHA-256·바이트 수, 필요한 Production Auth URL, UAT 결과와 알려진 제한을 포함합니다. GLB v02처럼 대용량·고폴리곤 원본은 모바일 성능 측정이 완료되지 않았으면 `performance_review_required` 상태로 남깁니다.

### Gate 3 — Production preparation

대표 승인 뒤에만 Production Supabase에 비파괴 migration을 적용합니다. 그 다음 승인된 public 사진·GLB만 동일한 버전 key로 업로드하고 checksum을 재검증합니다. staging의 private 원본, 실험 데이터, 미검수 초안은 Production에 복사하지 않습니다.

### Gate 4 — Code promotion and production UAT

`staging → main` 병합 후 Vercel Production 배포 SHA를 확인합니다. Production의 stable domain에서 buyer Magic Link, 5면 사진, GLB/사진 폴백, 개인화 프리뷰, 보호된 다운로드 audit, 최종 요청을 소량 UAT합니다. 결제는 이 단계에서 자동 연결하지 않으며, 운영자 검토 후 별도 결제 링크 또는 계좌 안내로 진행합니다.

### Gate 5 — Rollback discipline

코드는 마지막 안정 `main` commit으로 되돌릴 수 있습니다. public asset은 이전 version key를 보존해 source mapping만 이전 승인본으로 되돌립니다. 이미 적용한 Production migration은 삭제·드롭으로 되돌리지 않고, 별도 forward-fix migration으로 수정합니다. buyer request와 audit row는 삭제하지 않습니다.

## Current boundary

현재 Bernese GLB v02와 product-model metadata migration 012는 staging에서만 검증 대상입니다. Production catalog asset, Production migration 009–012, Production Auth URL 설정, `main` 병합은 아직 승인 대상이 아닙니다. 이 경계를 유지하면 staging 주문 UX 실험이 실제 고객·제조 데이터에 영향을 주지 않습니다.
