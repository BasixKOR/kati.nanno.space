# KATI (같이)

> 같이의 가치를 만듭니다

## 소개

KATI는 한국의 서브컬처 행사 정보를 크롤링하여 구조화된 오픈 데이터로 제공하는 플랫폼입니다.

기존 행사 플랫폼들에 흩어져 있는 정보를 수집하고, Parquet 파일로 정규화하여 누구나 자유롭게 활용할 수 있도록 합니다.

## 대상 사용자

- **행사 참가자**: 어떤 행사에 갈지 탐색하고 계획하는 사람
- **데이터 활용자**: 구조화된 행사 데이터로 자신만의 도구를 만들거나 분석하려는 개발자 및 분석가

## 핵심 가치

- **오픈 데이터**: 폐쇄된 플랫폼에 갇힌 행사 정보를 추출, 정규화하여 Parquet 파일로 공개
- **더 나은 탐색 경험**: 기존 행사 사이트보다 편리한 검색과 브라우징 제공

## 아키텍처

```
크롤링 소스 → 정규화 → Parquet 파일 작성 → Git 커밋 → 웹사이트에서 읽기
                                                        ↓
                                                  DuckDB-WASM (브라우저 내 SQL 쿼리)
```

- **크롤러** (`apps/crawler`): GitHub Actions 크론 잡으로 매일 자정(KST) 실행. ink 기반 터미널 UI로 진행 상황 표시.
- **웹사이트** (`apps/website`): SolidJS SSR 앱. DuckDB-WASM 기반 쿼리 UI를 통해 Parquet 데이터를 브라우저에서 직접 SQL로 조회.
- **데이터베이스 없음**: 레포지토리의 Parquet 파일이 유일한 데이터 소스.

## 데이터 소스

동인/일러스트 행사부터 시작하여 점차 확장 예정:

- Illustar Fest
- Comic World
- (추후 확장: 멜론티켓, 인터파크, 공연예술통합전산망 등)

## 기술 스택

- **모노레포**: pnpm workspace
- **언어**: TypeScript
- **크롤러**: React + ink (터미널 UI), Valibot (검증), cheerio (HTML 파싱), ky (HTTP)
- **웹사이트**: SolidJS, DuckDB-WASM
- **데이터 포맷**: Parquet
- **CI/CD**: GitHub Actions
