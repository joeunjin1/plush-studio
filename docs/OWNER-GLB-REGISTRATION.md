# 대표 제공 GLB 등록 운영 기준

이 절차는 **원본 GLB를 DB에 저장하지 않고**, 조직 권한·버전·해시·검토 기록만 DB에 보관하기 위한 staging 우선 운영 기준입니다. 원본 파일은 private `plush-studio` storage bucket에, 승인되어 구매자에게 공개할 복사본만 public `plush-studio-catalog` bucket에 둡니다.

## 등록 순서

| 단계 | 담당 | 저장 위치 | 완료 기준 |
|---|---|---|---|
| 1. 원본 접수 | 대표/담당 MD | 대표 보관본 | 제품 SKU, 모델 버전, 원본 파일명을 확정합니다. |
| 2. 초안 업로드 | 해당 조직 `brand_admin` | private `plush-studio` | `{organization_id}/reference-products/models/{model_version}/{filename}` 형식으로 저장합니다. |
| 3. 메타데이터 등록 | 해당 조직 `brand_admin` | `reference_product_models` | SKU 대상, 버전, 크기, SHA-256, 메시·삼각형·재질·텍스처 수, 원본 경로를 등록합니다. |
| 4. 무결성·형상 검토 | 대표/모델 검수자 | DB 검토 기록 | 독립 다운로드 SHA-256 일치, 5면 기준 비교, 시작 각도, 재질, 모바일 성능을 검토합니다. |
| 5. 공개 복사본 준비 | 승인된 운영 절차 | public `plush-studio-catalog` | 검토된 동일 바이트를 버전 키로 복사하고 public path를 기록합니다. |
| 6. 구매자 공개 | 해당 조직 `brand_admin` | `publish_reference_product_model` | 상품 권리·상품 검토·모델 검토·해시 검증·public path가 모두 승인 상태여야 합니다. |

> **공개 금지 원칙:** `draft`, `pending_review`, `changes_requested`, `rejected` 상태의 원본은 private bucket에만 보관합니다. 공개 카탈로그에는 검토·해시 확인이 끝난 버전만 복사합니다.

## 필수 메타데이터

| 필드 | 목적 |
|---|---|
| 대상 SKU / reference product | 어느 공식 상품의 모델인지 식별합니다. SKU는 조직 안에서 중복될 수 없습니다. |
| `model_version` | 같은 상품 내 중복을 막고, 이전 버전 롤백을 유지합니다. |
| 원본 파일명·private storage path | 원본 출처와 파일 위치를 추적합니다. |
| 바이트 수·SHA-256 | 업로드 중 변형·오배포 여부를 판별합니다. |
| mesh·triangle·material·texture·animation 정보 | 브라우저 품질·모바일 성능 검토의 근거로 사용합니다. |
| 검토 상태·검토자·검토 시각·메모 | 구매자 공개 전 책임과 보류 사유를 남깁니다. |
| public catalog path·현재 버전 표시 | 승인된 모델만 buyer 3D view에 노출하도록 만듭니다. |

## 현재 Bernese v02의 적용 범위

현재 Bernese memorial plush v02는 staging public catalog에 대표 제공 원본으로 이미 등록되어 시각 UAT를 통과했습니다. 그러나 이 문서와 migration 012는 **후속 상품부터 적용할 정식 메타데이터 등록 계약**입니다. v02를 이 테이블에 소급 등록하려면, 대표가 private 원본 보존 경로와 SKU의 조직 소유 관계를 먼저 확인한 뒤 staging에서만 별도 등록합니다.

Production 전환은 별도 승인 절차입니다. staging SQL 적용, private 원본 업로드, 독립 해시 검증, public 승인 복사본 확인, 5면 사진 폴백 및 모바일 UAT를 Production에서 다시 수행하기 전에는 `main` 병합이나 Production 자산 교체를 진행하지 않습니다.
