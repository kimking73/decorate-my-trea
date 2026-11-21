# 포스텍 트리 — 제품 스펙

> 마지막 갱신: 2026-11-17 (애니메이션 성능 규칙·동작 줄이기(C2): 4.2, 2.1 · 데모 전용 주인 화면 미리보기 `?owner=1`: 4.2 · 장식 페이지 넘김(C3): 5.1 · 12/25 0시 동시 접속 대비: 4.5, 6장 · 서버 담당: 2장 · 문서 간 중복 제거·환경변수 표 통합: 1.1, 7장 · QA용 데모 배포·공유 주소 기본값: 1.1 · plan.md 기술 스택 작업 가이드 규칙: 7장 · 작업 관리 규칙 추가: 7장 · 프론트엔드·서버 역할 분리: 2장 · 기술 스택 확정: 1.1, 3~6장) · 작업을 시작하기 전에 이 문서를 먼저 고치고, 구현 단계는 [`plan.md`](./plan.md)에 체크리스트로 남깁니다.

## 1. 개요
- **목표**: POSTECH 학생들이 인스타그램에 자기 트리 링크를 올리고, 친구들이 **익명 편지**를 장식으로 달아주는 연말 이벤트. 편지는 **12/25 00:00 KST**에 열린다.
- **오픈**: 12/1 (트리 전구가 12/1부터 켜지기 시작)
- **참고 서비스**: colormytree.me
- **스택**: Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 · Supabase (Auth, Postgres, RLS) · Vercel — 자세한 구성은 1.1

### 1.1 기술 스택
**방향**: **기존 프로토타입 코드를 유지**하고, 출시 전에 확실한 위험(인앱 브라우저 이미지 저장, 캠퍼스 공용 IP, 동시 요청으로 작성 제한 초과)만 고친다. 사용자는 대부분 인스타·카카오톡 **인앱 브라우저**로 들어오고, "12/25 전에는 아무도 못 본다"는 약속은 DB가 지킨다.

```
인앱 브라우저 ─▶ Vercel: Next.js 페이지(SSR) ─▶ /api/letters ─▶ Supabase: submit_letter() ─▶ Postgres(RLS)
   │               └─▶ 카카오·구글 OAuth ─▶ Supabase Auth ─(auth.uid)─▶ Postgres RLS
   ├─ 스토리 이미지: 브라우저에서 html-to-image로 생성 → 공유 시트 / 길게 눌러 저장
   └─ 오류 ─▶ Sentry (선택)
```

| 영역 | 기술 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js 15 (App Router) · React 19 · TypeScript | 유지 |
| 스타일 | Tailwind CSS v4 (`@theme` 토큰) · CSS 애니메이션 | 유지 |
| 폰트 | `next/font/google` (Jua, Gowun Dodum) 자체 호스팅 | **변경** (기존 `<link>`, 수정 범위 `app/layout.tsx`) |
| 장식 아이콘 | SVG `public/ornaments/<id>.svg` | 기존 계획대로 이모지 → SVG |
| 연출 | canvas-confetti | 유지 |
| 스토리 이미지 | `html-to-image`로 화면의 트리를 캡처 (유지) → **저장 방식만 변경**: `navigator.share({ files })`, 안 되면 이미지를 띄워 "길게 눌러 저장" 안내 | **변경** (기존 `<a download>`는 인앱 브라우저에서 막힐 가능성이 큼. 수정 범위 `ShareButtons.tsx`) |
| 링크 미리보기 | 정적 OG 이미지 1장 (`app/opengraph-image.png`) | 유지 |
| 카카오톡 공유 | Kakao JavaScript SDK | **선택** (M2 여유 시, 도메인 등록 필요) |
| DB · 인증 | Supabase Postgres · Auth (카카오, 구글) · RLS | 유지 |
| DB 관리 | SQL Editor로 적용, 마이그레이션 파일은 `supabase/migrations/`에 커밋 | 유지 |
| 편지 저장 | Postgres 함수 `submit_letter()` — 트리 확인·작성 제한·INSERT를 한 트랜잭션에서 처리 | **변경** (기존: API에서 개수 조회 후 INSERT. 수정 범위 `/api/letters`, 마이그레이션 `0002`) |
| 작성 제한 | 브라우저 ID(`anon_id` 쿠키) + IP 기준 | **변경** (기존 IP만 기준이라 캠퍼스망에서 서로 막힐 수 있음. 4.4) |
| 호스팅 | Vercel (Hobby) · PR마다 Preview 배포 | 유지 |
| QA용 데모 배포 | 실서버(S1~S3)보다 먼저 **환경변수 없이** Vercel에 배포 → 데모 모드 HTTPS 주소(`https://<프로젝트>.vercel.app/t/demo`). 인앱 브라우저·실기기 QA(C1·C2)는 이 주소로 한다. 실서버 배포(S4)는 같은 Vercel 프로젝트에 환경변수·도메인을 더한다 | **신규** (S16. 인스타·카톡 링크와 `navigator.share`는 HTTPS 주소가 필요) |
| CI | GitHub Actions — lint · typecheck · build + 빈 Postgres 컨테이너에서 `scripts/test-rls.sql` | **신규** (기존 스크립트 그대로 사용) |
| 관측 | Vercel Analytics (유입) · Sentry (오류, **선택**) | **신규** |
| 도메인 | 고정 도메인 구매 권장 (연 1~2만 원) | **신규** (6장 결정 필요) |
| 제거 | `framer-motion` (설치만 되어 있고 미사용) | |

**지금은 하지 않고, 필요해지면 추가** (6장)
- Cloudflare Turnstile 봇 방어 — 도배가 실제로 생기면 (인앱 브라우저에서 실패하면 편지를 못 쓰게 되는 위험이 있어 보류)
- 트리별 OG 이미지 · 서버 생성 스토리 이미지(`next/og`) — 트리를 따로 다시 그려야 하고 화면 상태(포닉스 등)를 잃음
- Supabase CLI · Playwright E2E — 운영 기간이 짧고 마이그레이션이 2개뿐. 베타 수동 테스트로 대체

**쓰지 않기로 한 것**: Firebase (행 단위 공개 규칙을 짜고 테스트하기 어려움), 별도 백엔드 서버 (운영 부담), 네이티브 앱 (인스타 링크에서 바로 써야 함), Upstash Redis (Postgres 함수로 충분)

**환경변수** (`.env.local`, Vercel 동일 · 예시는 `.env.example`) — 환경변수 목록은 여기에만 적는다.

| 이름 | 공개 여부 | 용도 | 쓰는 곳 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 | Supabase 클라이언트. 없으면 데모 모드 | `lib/supabase/*`, `middleware.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** | `submit_letter()` 호출 | `createAdminClient()` → `app/api/**`에서만 |
| `IP_HASH_SALT` | **서버 전용** | IP·브라우저 ID 해시 솔트 | `/api/letters` |
| `NEXT_PUBLIC_SITE_URL` | 공개 | 공유 링크·OG 기준 주소. 없으면 Vercel이 넣어 주는 배포 주소(프로덕션은 `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`, Preview는 `NEXT_PUBLIC_VERCEL_URL`), 그것도 없으면 `http://localhost:3000` | `SITE_URL` (`lib/constants.ts`, `metadataBase`) |
| `NEXT_PUBLIC_REVEAL_AT` | 공개 | 공개 시각 표시용 기본값. 실제 공개는 DB `app_config.reveal_at` | `REVEAL_AT` (`lib/constants.ts`) |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 공개 | (선택) 카카오톡 공유 | `lib/kakao.ts` (C11) |
| `NEXT_PUBLIC_SENTRY_DSN` | 공개 | (선택) 오류 수집 | Sentry 설정 (S15) |

**비용**: 도메인 외 0원 (Vercel Hobby는 비상업 용도 한정, Supabase Free는 약 1주일 미사용 시 일시정지되니 개발 공백 주의)

## 2. 팀과 역할

| 역할 | 담당 | 한 줄 정의 |
| --- | --- | --- |
| 디자인 | (별명 미정) | 비주얼 아이덴티티, 일러스트, 아이콘, 공유 이미지 |
| 프론트엔드 | 와장창프론트엔드 | 트리 화면 밖의 페이지 구성·라우팅·폼 (홈, 로그인, 트리 생성, 내 페이지, 관리자), 디자인 반영, 메타데이터·OG·폰트 |
| 서버 | 민준 | DB·RLS·API·인증(OAuth)·미들웨어·배포·CI·모니터링 |
| 클라이언트 | 람쥐썬더 | 트리 화면의 렌더링과 인터랙션 (애니메이션, D-day 연출, 이스터에그, 편지 작성·열람 UI, 공유) |

**프론트엔드와 서버의 경계**: 프론트엔드는 `app/actions.ts`의 서버 액션과 `lib/data.ts`의 조회 함수를 **호출만** 하고, 쿼리·권한·RLS·API 구현은 서버가 맡는다. 화면에 필요한 데이터나 액션이 새로 생기면 프론트엔드가 2.2의 계약에 먼저 적고 서버에 요청한다.

### 2.1 소유 파일 맵
누가 고쳐도 되지만, **소유자가 리뷰**한다.

| 영역 | 소유 | 파일 |
| --- | --- | --- |
| 트리 화면 / 인터랙션 | 클라이언트 | `components/TreeScene.tsx`, `TreeView.tsx`, `WriteForm.tsx`, `LetterModal.tsx`, `Snow.tsx`, `Countdown.tsx`, `ShareButtons.tsx`, `lib/season.ts`, `app/globals.css` (애니메이션 부분), `scripts/perf-measure.mjs`, `docs/qa-c2-device.md` |
| 카카오톡 공유 (선택) | 클라이언트 | `lib/kakao.ts` |
| 페이지 / 폼 | 프론트엔드 | `app/**/page.tsx`, `app/layout.tsx`, `app/not-found.tsx`, `app/opengraph-image.png`, `components/TreeForm.tsx`, `LoginButtons.tsx`, `ClaimForm.tsx`, `AdminCreateForm.tsx`, `package.json` (프론트엔드 의존성) |
| 데이터 / 서버 | 서버 | `app/actions.ts`, `app/api/**`, `app/auth/**`, `middleware.ts`, `lib/data.ts`, `lib/supabase/**`, `lib/moderation.ts`, `supabase/migrations/**`, `scripts/test-rls.sql`, Vercel·Supabase 설정 |
| CI / 관측 | 서버 | `.github/workflows/**`, (선택) `sentry.*.config.ts`, `instrumentation.ts` |
| 작업 관리 | 공통 | `plan.md`, `scripts/sync-plan.mjs` (7장) |
| 디자인 토큰 / 에셋 | 디자인 (코드 반영은 클라이언트) | `app/globals.css`의 `@theme`, `lib/constants.ts`의 `ORNAMENTS`·`THEMES`, `public/` |

### 2.2 팀 간 계약 (바꾸려면 이 문서를 먼저 수정하고 상대에게 공유)
1. **데이터 타입**: `lib/data.ts`의 `Tree`, `OrnamentRow`, `Stats`
2. **컴포넌트 props**: `TreeScene` (`theme`, `ornaments`, `season`, `onOrnamentClick`, `starMode`, `crying`, `lockedIcons`), `TreeView` (`tree`, `ornaments`, `letters`, `isOwner`, `isLoggedIn`, `season`, `revealAt`, `shareUrl`, `justAdded`, `egg`, `demo`)
3. **API**: 아래 5장 `POST /api/letters`
4. **장식 ID**: `lib/constants.ts`의 장식 `id`는 DB `letters.ornament_type`에 저장된다. **이미 쓰인 id는 바꾸거나 지우지 않는다** (아이콘 이미지만 교체).
5. **서버 액션·조회 함수** (프론트엔드 ↔ 서버): `app/actions.ts`의 함수 이름·인자·반환값, `lib/data.ts`의 조회 함수 이름·반환 타입

## 3. 사용자 흐름

### 트리 주인
1. 홈 → 카카오/구글 로그인 → **이름만 입력**해 트리 생성 (트리 이름은 자동으로 "OO님의 트리")
2. 트리 링크 공유 (Web Share / 링크 복사 / 스토리용 이미지, 선택: 카카오톡 공유). 스토리 이미지는 화면의 트리를 캡처해 공유 시트로 넘기고, 공유 시트가 없으면 이미지를 띄워 "길게 눌러 저장"을 안내
3. 크리스마스 전: 받은 편지 **개수**만 보이고, 장식을 누르면 "🔒 D-N"
4. 12/25 0시 이후: 장식을 누르면 봉투 애니메이션과 함께 편지 열람. 고백 편지는 이때만 "💘 고백 편지" 라벨 표시. 부적절한 편지는 신고/숨기기

### 친구 (로그인 없음)
1. 인스타 링크 → 트리 화면 → "트리 꾸며주기"
2. 장식 선택 (기본 / POSTECH / 학과 / 교수님 트리면 교수님 전용 탭)
3. 닉네임(선택, 기본 "익명의 산타") + 편지(1~1000자) + "💘 이 편지는 고백이에요" 체크(선택)
4. 트리에 장식이 달리는 애니메이션 → 트리 화면으로 복귀

### 교수님 / 특별 트리
- 관리자가 `/admin`에서 생성 (칠판 테마, 교수님 전용 장식) → 초대 코드 발급 → 교수님이 로그인 후 `/me`에서 코드를 입력해 트리 주인이 됨

## 4. 기능 규칙

### 4.1 핵심 제약
- **공개 시점은 DB에서 강제**: 편지 본문은 RLS로 `트리 주인 AND now() >= app_config.reveal_at`일 때만 조회 가능. 클라이언트 시간과 무관.
- **익명**: 작성자 계정을 저장하지 않음. IP와 브라우저 ID는 솔트 해시(`ip_hash`, `client_hash`)만 저장, 누구에게도 노출하지 않음.
- **고백 편지**: 작성자가 체크. 트리에서는 일반 장식과 똑같이 보이고, `get_ornaments`도 고백 여부를 반환하지 않음 → 주인도 공개 전엔 모름. 홈 화면 "지금까지 총 N명이 고백하였습니다"에만 집계. 공개 후 주인이 편지를 열 때만 라벨 표시.

### 4.2 D-day 연출 (`lib/season.ts`)
| 시점 | 연출 |
| --- | --- |
| 12/1 이전 | 불 꺼진 트리, "12월 1일부터 트리에 불이 하나씩 켜져요" |
| 12/1 ~ 12/24 | 전구 24개 중 하루 1개씩 점등 (트리 전체에 흩어진 순서), 눈이 점점 쌓임(층 테두리·꼭대기·바닥), 내리는 눈 증가 |
| D-7 ~ | 꼭대기 별이 빛나기 시작 |
| D-3 ~ D-1 | 트리 아래 선물 상자 1→3개 |
| 12/25 ~ | 전구 전부 + 무지개 순환, 눈 수북, 선물 3개 |

- 개발/데모 모드에서 `?dday=N`으로 미리보기 (프로덕션에선 무시, 편지 권한과 무관)
- **데모 모드에서만** `/t/<slug>?owner=1`로 주인 화면 미리보기 (공유 버튼·스토리용 이미지 저장·"내 페이지"). 인앱 브라우저 QA(C1)용이며 `?dday=N`과 함께 쓸 수 있다. 기준은 `NODE_ENV`가 아니라 `demoMode`(Supabase 환경변수 없음)라서 Supabase가 설정된 서버에서는 무시된다. 화면만 주인용으로 그리고 편지 본문 권한(RLS)과는 무관하다. `?owner=1&dday=0`이면 장식을 눌러 가짜 데모 편지(고백 편지 1통 포함)를 열 수 있다 — 데모 `getLetters()`가 돌려주는 고정 문구이며 DB와 무관하다. 데모 화면에는 "주인 화면으로 보기" ↔ "방문자 화면으로 보기" 전환 링크와 "데모: 주인 화면 미리보기" 표시가 나온다.

**애니메이션 성능 규칙 (C2)** — 저사양 폰 기준. 측정값과 실기기 체크리스트는 [`docs/qa-c2-device.md`](./docs/qa-c2-device.md).
- 계속 도는 애니메이션은 `transform`·`opacity`만 움직인다. `filter`·색(`color`, `fill`)·그림자를 무한 애니메이션하지 않는다 (매 프레임 메인 스레드에서 다시 그린다). 색이 바뀌어야 하면 색이 다른 복사본을 겹쳐 `opacity`로 바꾼다 (무지개 전구, 빛나는 별).
- 전구는 SVG 필터 없이 HTML + `box-shadow`로 그린다.
- 내리는 눈은 초당 30번 그리고, 탭이 가려지면 멈춘다. 캔버스는 CSS 픽셀 크기(1배)로 둔다.
- `prefers-reduced-motion`이면 계속 도는 연출(눈·장식 흔들림·전구 깜빡임·무지개·별)을 멈춘 채로 보여 준다. 탭해서 나오는 반응(별·포닉스·토스트)은 그대로 둔다.
- 연출을 바꿨으면 `node scripts/perf-measure.mjs`(데모 모드 `npm start` 상태)로 전/후를 비교한다. 헤드리스 수치는 비교용이며 실기기 확인을 대신하지 않는다.

### 4.3 이스터에그
- **꼭대기 별**: 탭마다 반짝, 7연타 → 전구 전부 켜지며 체이스 + 산타 썰매
- **포닉스**: 트리 왼쪽 아래 포닉스 탭 → 포스텍 레드 트리 (다시 탭하면 원래대로)
- **편지 키워드**: `종강` 폭죽 / `과제·레포트·랩실` 장식이 울음 / `학점·a+` 별이 A+ / `사랑해·좋아해·보고싶` 하트

### 4.4 운영 / 안전
- **작성 제한**: `submit_letter()` 안에서 세고 저장까지 한 트랜잭션으로 처리 (동시 요청으로 넘을 수 없음)
  - 같은 브라우저(`client_hash`): 분당 5개, 한 트리에 하루 10개
  - 같은 IP(`ip_hash`): 분당 30개 — 캠퍼스망·기숙사에서 여러 학생이 같은 공인 IP를 쓸 수 있어 넉넉하게 둠. 베타(M3)에서 학교망으로 확인 후 조정
  - 브라우저 ID는 서버가 발급하는 httpOnly 쿠키 `anon_id` (쿠키를 지워 우회하는 경우는 IP 제한이 막음)
  - 도배가 실제로 생기면 Turnstile 봇 방어를 추가 (6장)
- 금칙어 필터 (`lib/moderation.ts`)
- 주인 신고 → 숨김 → 관리자가 복구/삭제

### 4.5 12/25 0시 동시 접속
모든 편지가 같은 순간에 열리므로 트래픽이 0시 직후 몇 분에 몰린다. 목표: **0시 이후 첫 10분 동안 편지 열람 오류율 1% 미만, 응답 p95 3초 이내** (목표 동시 접속 수는 S18에서 가입 트리 수로 정한다).

- **지금 구조의 부담** (2026-11-16 코드 기준)
  - 트리 페이지 1회 = Supabase 호출 약 7번: 미들웨어 `getUser()`(Auth 서버) · `generateMetadata`와 본문의 `getTreeBySlug` 중복 · 본문 `getUser()` 다시 · `get_ornaments` · `app_config` · `getLetters`. 요청 안에서 중복을 없애는 캐시가 없다.
  - 홈 1회 = `get_stats()`가 `letters` 전체를 4번 `count(*)` 한다. 0시에는 홈 방문도 몰린다.
  - 0시 전에 열어 둔 화면은 저절로 바뀌지 않아 모두가 새로고침을 연타한다 (동시에 몰리는 요청이 몇 배가 된다).
- **규칙**
  - 공개 시각에 화면을 바꿀 때 **모든 클라이언트가 같은 순간에 요청하지 않는다**: 0시가 되면 트리 주인은 0~30초, 방문자는 0~120초 사이 무작위로 기다린 뒤 한 번 새로 고친다. 실패하면 점점 길게(예: 2·4·8·16초, 각자 무작위 가감) 재시도하고, 그동안 "편지를 꺼내는 중" 연출을 보여 준다.
  - 같은 요청 안의 같은 조회는 한 번만 한다 (React `cache()`로 `getUser`·`getTreeBySlug` 중복 제거).
  - 홈 통계는 실시간일 필요가 없다: 결과를 최대 60초 캐시한다. 편지 본문·장식처럼 권한이 걸린 조회는 **캐시하지 않는다** (사용자별 RLS).
  - 공개 시점 판단은 여전히 DB(`is_revealed()`)가 한다. 무작위 대기는 요청을 흩는 용도일 뿐 권한과 무관하다.
- **검증**: 12/24 전에 부하 테스트(S18)로 목표를 확인하고, 무료 플랜 한도에 걸리면 12/24~12/26만 유료 플랜으로 올릴지 정한다 (S19, 6장).

## 5. 인터페이스

### 5.1 화면
| URL | 설명 | 로그인 |
| --- | --- | --- |
| `/` | 홈: 카운트다운, 트리 미리보기, 고백 카운터, 통계(트리/편지/오늘 편지), 교수님 트리 목록 | - |
| `/login` | 카카오/구글 로그인 | - |
| `/create` | 트리 생성 / 이름 변경 | 필요 |
| `/me` | 내 트리, 받은 편지 수, 교수님 초대 코드 입력, 로그아웃 | 필요 |
| `/t/[slug]` | 트리 보기 (주인/방문자 분기) | - |
| `/t/[slug]/write` | 장식 선택 + 편지 작성 | - |
| `/admin` | 특별 트리 생성, 초대 코드, 신고 처리 | 관리자 |

**트리 넘김 (C3, `/t/[slug]`)** — 장식은 한 트리에 18개. 넘으면 "다음 트리"로 넘겨 본다.
- 순서: 오래된 편지부터. 첫 화면은 1번째 트리, 편지를 막 달고 돌아오면(`?added=1`) 새 장식이 있는 마지막 트리 + pop-in.
- 넘기기: 트리 영역 좌우 스와이프(세로 스크롤은 막지 않음), ◀ ▶ 버튼, 트리 안에 포커스가 있을 때 ←/→ 키.
- 표시: `3 / 12` 숫자 + "처음"/"최신" 바로가기. 트리가 1개면 표시하지 않는다.
- 전환: 트리·전구·별은 그대로 두고 장식 묶음만 바뀐다. `prefers-reduced-motion`이면 애니메이션 없이 바로 바꾼다.
- 접근성: 넘김 버튼에 이름("이전 트리"/"다음 트리")을 붙이고, 넘길 때 "트리 N개 중 M번째 트리"를 화면 낭독기로 알린다.
- 스토리 이미지 저장은 지금 보고 있는 트리를 그대로 찍는다 (총 편지 수는 캡처 영역 안, 넘김 버튼은 밖).
- 장식이 줄어(신고 등) 트리 수가 줄면 마지막 트리로 맞춘다.
- 확인용: 데모 모드에서만 `?fill=60`으로 데모 장식을 복제해 채운다 (실서버에서는 무시). 스와이프 기준 거리·애니메이션 시간 같은 값은 `components/TreeView.tsx`·`app/globals.css`에 있다.

### 5.2 API — `POST /api/letters`
요청 (JSON)
```json
{ "treeId": "uuid", "ornamentType": "ball-red", "nickname": "선택", "content": "1~1000자", "isConfession": false }
```
- 요청·응답 형식은 **기존과 같다** (클라이언트 `WriteForm.tsx` 수정 불필요)
- 서버 처리 순서: 입력 검증·금칙어 → `anon_id` 쿠키 확인(없으면 발급) → IP·브라우저 ID 해시 → `submit_letter()` 1회 호출

응답
- `200 { "ok": true }` (데모 모드는 `{ "ok": true, "demo": true }`)
- `400 { "error": "..." }` 장식 id 오류 / 길이 / 금칙어
- `404` 트리 없음 · `429` 작성 제한 초과 · `500` 저장 실패

### 5.3 데이터 모델 (`supabase/migrations/`, SQL Editor로 적용)
- `app_config(reveal_at)` — 공개 시각 (기본 `2026-12-25 00:00+09`)
- `profiles(id, display_name, is_admin)`
- `trees(id, owner_id, slug, title, owner_name, theme, department, kind[user|professor|special], description, claim_code)` — 일반 유저 1인 1트리
- `letters(id, tree_id, ornament_type, nickname, content, is_confession, ip_hash, client_hash, reported, hidden, created_at)` — `client_hash` **추가** (인덱스 `(client_hash, created_at)`)
- RPC: `get_ornaments(tree_id)`(본문·고백 여부 제외), `get_stats()`, `report_letter`, `claim_tree`, `admin_*`
- RPC **추가**: `submit_letter(tree_id, ornament_type, nickname, content, is_confession, ip_hash, client_hash)` — `security definer`, service role만 실행 가능 — 기존 관리자 함수처럼 반드시 `revoke execute ... from public, anon, authenticated` (안 하면 브라우저에서 직접 호출해 작성 제한을 건너뛸 수 있음) 후 `grant execute ... to service_role` (`public`에서 회수하면 service role도 실행 권한을 잃으므로 명시적으로 다시 줘야 함). 트리 존재 확인·작성 제한 확인·INSERT를 한 트랜잭션에서 처리하고, 제한 초과 시 오류 코드를 돌려줌 (API가 `429`로 변환)

## 6. 미정 / 범위 밖
- 포닉스: 학교 공식 캐릭터 이미지를 쓰려면 사용 허락 필요. 현재는 직접 그린 오리지널 불새.
- 도메인: 구매를 권장 (`*.vercel.app`은 신뢰도가 낮아 보이고, 카카오 공유 SDK 도메인 등록에도 고정 주소가 편함). 이름과 구매자 결정 필요
- 학교망 IP 구조: 작성 제한 숫자(4.4)는 베타에서 확인 후 확정
- 12/25 플랜 증설: 부하 테스트(S18) 결과로 Supabase·Vercel을 공개 기간에만 유료로 올릴지, 비용은 누가 낼지 (4.5)
- 필요해지면 추가 (1.1): Turnstile 봇 방어, 트리별 OG·서버 생성 스토리 이미지, Supabase CLI, Playwright E2E
- 크리스마스 이후 서비스 종료/보관 정책
- 범위 밖: 모바일 네이티브 앱, 실시간 알림, 편지 답장

## 7. 작업 관리 (타임라인 · plan.md)
- **기준은 타임라인**: 📅 [포스텍 트리 개발 타임라인](https://claude.ai/artifact/XZPtaxuvxWC3hkFvo1VyNi). 사람은 타임라인을 보고 일한다. 작업 추가·일정·선행 작업·완료 기준·완료 체크는 타임라인에서 바꾼다.
- **작업 번호**: 레인 문자 + 숫자. `D` 디자인 · `F` 프론트엔드 · `S` 서버 · `C` 클라이언트 · `T` 공통 (예: `S11`). 한 번 쓴 번호는 바꾸거나 다시 쓰지 않는다 (지운 작업의 번호 포함).
- **plan.md는 타임라인의 사본**: `<!-- timeline:start -->`와 `<!-- timeline:end -->` 사이의 작업 목록은 타임라인에서 생성하며 손으로 고치지 않는다. 둘이 다르면 **타임라인이 맞다**.
- **동기화**: 타임라인을 바꾸면 `node scripts/sync-plan.mjs <타임라인 HTML 또는 state JSON>`으로 plan.md를 다시 만들어 커밋한다. 스크립트는 타임라인 페이지의 `<script id="state">` JSON을 읽어 마커 사이만 교체한다.
- **타임라인에 아직 없는 작업**: 타임라인을 고칠 수 없는 사람·세션이 찾은 작업은 plan.md의 "타임라인에 아직 없는 작업"에 적고, 타임라인 편집 권한이 있는 사람이 옮긴다.
- **Claude에게 맡기기**: "S11 해줘"처럼 작업 번호로 요청한다. Claude가 따르는 절차는 `CLAUDE.md`의 "작업 번호로 요청받았을 때"에 있다.
- **한 내용은 한 곳에만**: 결정·규칙·계약·환경변수는 이 문서, 꼭 지킬 제약·작업 절차·명령어·검증은 `CLAUDE.md`, 코드를 어떻게 짜는지(버전·파일 역할·데이터 접근 패턴·인증·데모 모드·스타일)는 plan.md의 "기술 스택 · 작업 가이드"에 적는다. 다른 문서의 내용은 다시 쓰지 않고 절 이름으로 가리킨다.
- **plan.md의 "기술 스택 · 작업 가이드"**: 타임라인 마커 **밖**에 있어 동기화로 지워지지 않는다. 스택·계약이 바뀌어 그 절의 코드 설명이 틀리게 되면 이 문서를 먼저 고치고 같은 커밋에서 그 절도 맞춘다.
- **완료 표시**: 완료 기준을 만족하면 타임라인에서 완료 체크(기준)하고, plan.md는 다음 동기화 때 맞춰진다. Claude가 작업을 끝낸 경우 같은 커밋에서 plan.md도 `[x]`로 바꾼다.
