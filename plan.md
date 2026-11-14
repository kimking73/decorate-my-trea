# 포스텍 트리 — 구현 계획

> 마지막 갱신: 2026-11-14 (타임라인 기준·작업 번호 체계, 스펙 7장)
> 📅 **기준은 [타임라인 (간트 차트)](https://claude.ai/artifact/XZPtaxuvxWC3hkFvo1VyNi)** 입니다. 사람은 타임라인을 보고 일하고, 작업 추가·일정·완료 체크도 타임라인에서 합니다.
> 이 문서의 작업 목록은 타임라인의 사본이라 **손으로 고치지 않습니다.** 타임라인을 바꾼 뒤 `node scripts/sync-plan.mjs <타임라인 HTML>`로 다시 만듭니다. 둘이 다르면 타임라인이 맞습니다.
> 표기: 🎨 디자인(D) · 🖥 프론트엔드(F) · 🛠 서버(S) · 📱 클라이언트(C) · 👥 공통(T) · 스펙은 [`spec.md`](./spec.md)

## Claude에게 맡기기
- 작업 번호로 요청합니다: "**S11 해줘**", "**C7 해줘**"
- Claude는 `CLAUDE.md`의 "작업 번호로 요청받았을 때" 절차대로 선행 작업 확인 → 스펙 확인 → `task/<번호>` 브랜치에서 작업 → 검증 → 완료 체크까지 진행합니다.
- 디자인 시안, 외부 콘솔 설정(OAuth·도메인·Vercel·Supabase 대시보드), 실기기 QA, 베타, 공지는 사람이 해야 하는 일입니다. Claude는 이런 단계를 따라 할 수 있는 안내로 정리해 줍니다.

## 마일스톤

| 날짜 | 마일스톤 | 완료 기준 |
| --- | --- | --- |
| 11/19 (목) | **M1 기반** | 🎨 핵심 시안(트리·장식·편지지) 공유 · 🛠 Supabase 실서버 연결 + 로그인 동작 + `submit_letter()`로 편지 저장 + CI 통과 · 🖥 실서버로 로그인 → 트리 생성 → 내 페이지 흐름 동작 |
| 11/26 (목) | **M2 디자인 반영 & 배포** | 📱 시안 반영 + 인앱 브라우저 이미지 저장 개선 · 🖥 홈·로그인·내 페이지·관리자 디자인 반영 · 🛠 Vercel 배포 URL(도메인)에서 전체 흐름 동작 |
| 11/29 (일) | **M3 베타** | 지인 10명 테스트 (인스타·카톡 인앱 브라우저, 학교망에서 작성 제한 확인 포함), 버그 수정 |
| 12/1 (화) | **M4 오픈** | 인스타 공지, 전구 점등 시작 |
| 12/24 (목) | 공개 리허설 | 테스트 트리로 `reveal_at` 조작해 열람 확인 후 원복 |
| 12/25 (금) 0시 | 편지 공개 | 모니터링 |

## 0. 지금까지 완료 (프로토타입)
- [x] Next.js + Tailwind 프로젝트 셋업, GitHub 연동 (`kimking73/decorate-my-trea`)
- [x] DB 스키마 + RLS + RPC, 로컬 Postgres RLS 테스트 통과
- [x] 카카오/구글 로그인 코드, 트리 생성(이름만), 내 페이지, 관리자 페이지
- [x] 익명 편지 API (검증·rate limit·금칙어)
- [x] 트리 화면, 편지 작성, 편지 모달, 공유, D-day 연출, 이스터에그
- [x] Supabase 없이 도는 데모 모드 (`/t/demo`, `/t/prof-demo`)

## 기술 스택 · 작업 가이드 (AI가 작업 전에 읽을 것)
> 이 절은 타임라인 마커 밖에 있어 동기화로 지워지지 않습니다. 결정의 기준은 `spec.md` 1.1(스택)·2장(역할·계약)·4~5장(규칙·API·DB)이고, 바뀌면 spec.md를 먼저 고친 뒤 같은 커밋에서 이 절도 맞춥니다. (2026-11-14 코드 기준)

### 한눈에 보기
```
인앱 브라우저(인스타·카톡) ─▶ Vercel: Next.js 15 App Router (서버 컴포넌트 SSR)
   ├─ 페이지 조회: lib/data.ts ─▶ Supabase(anon key + 사용자 세션 쿠키) ─▶ Postgres RLS
   ├─ 폼 제출:   app/actions.ts (서버 액션) ─▶ 같은 세션 클라이언트 ─▶ RLS
   ├─ 편지 작성: components/WriteForm.tsx ─fetch─▶ app/api/letters (service role) ─▶ letters INSERT
   └─ 로그인:    LoginButtons(브라우저 클라이언트) ─▶ 카카오·구글 OAuth ─▶ /auth/callback ─▶ 세션 쿠키
```
별도 백엔드 서버는 없습니다. 서버 로직은 Next.js 서버 컴포넌트·서버 액션·Route Handler와 Postgres 함수(RPC)가 전부입니다.

### 버전 (`package.json`)
| 구분 | 패키지 | 버전 | 비고 |
| --- | --- | --- | --- |
| 프레임워크 | `next` | ^15.5 | App Router. `params`·`searchParams`·`cookies()`는 **Promise**라 `await` 필요 |
| UI | `react`, `react-dom` | ^19.3 | 폼은 `useActionState` + 서버 액션 |
| 언어 | `typescript` | ^6.0 | `strict`, 경로 별칭 `@/*` → 루트. `scripts/`는 타입 검사 제외 |
| 스타일 | `tailwindcss`, `@tailwindcss/postcss` | ^4.3 | v4: `tailwind.config` 없음. 토큰은 `app/globals.css`의 `@theme` |
| DB·인증 | `@supabase/ssr` ^0.12, `@supabase/supabase-js` ^2.118 | | 서버·브라우저 클라이언트 |
| 연출 | `canvas-confetti` ^1.9 | | `WriteForm.tsx`에서 사용 |
| 이미지 | `html-to-image` ^1.11 | | `ShareButtons.tsx`에서 동적 `import()` |
| 가드 | `server-only` | | 서버 전용 모듈 첫 줄에 `import "server-only"` |
| 제거 예정 | `framer-motion` | ^14.9 | 설치만 되어 있고 미사용 → **F3**에서 제거. 새로 쓰지 말 것 |
| 린트 | `eslint` ^9 + `eslint-config-next` | | flat config(`eslint.config.mjs`), `next/core-web-vitals` + `next/typescript`, `scripts/**` 제외 |

로컬에 `node_modules`가 없으면 `npm install`부터 합니다. 새 의존성은 spec.md 1.1에 있는 것만 추가합니다.

### 디렉터리와 파일 역할 (소유는 spec.md 2.1)
| 경로 | 역할 | 실행 위치 |
| --- | --- | --- |
| `app/layout.tsx` | 루트 레이아웃, `metadata`·`viewport`, 폰트 (`<link>` → **F3**에서 `next/font/google`) | 서버 |
| `app/page.tsx` | 홈: 카운트다운·통계(`getStats`)·특별 트리 목록 | 서버 |
| `app/login/page.tsx` · `app/create` · `app/me` · `app/admin` | 로그인 / 트리 생성·이름 변경 / 내 페이지 / 관리자 | 서버 (+ 폼 컴포넌트는 클라이언트) |
| `app/t/[slug]/page.tsx` | 트리 보기. 주인이고 공개 이후면 `getLetters`(UI 분기일 뿐, 권한은 RLS), 아니면 장식만. `?dday=N`(개발·데모만), `?added`, `?egg` | 서버 → `TreeView` |
| `app/t/[slug]/write/page.tsx` | 장식 선택 + 편지 작성 (`WriteForm`) | 서버 → 클라이언트 |
| `app/actions.ts` | `"use server"` 서버 액션: `saveMyTree`, `claimTree`, `adminCreateSpecialTree`, `adminIssueClaimCode`, `adminResolve`. 반환 타입 `FormState = { error?: string } \| undefined`, 성공 시 `redirect()` | 서버 |
| `app/api/letters/route.ts` | `POST` 익명 편지 저장 (로그인 불필요, service role) | 서버 |
| `app/auth/callback/route.ts` | OAuth `code` → 세션 교환 후 `next`로 이동 (`/`로 시작하는 경로만 허용, 기본 `/me`) | 서버 |
| `app/auth/signout/route.ts` | `POST` 로그아웃 → `/` (303) | 서버 |
| `middleware.ts` | 매 요청 세션 쿠키 갱신 (`auth.getUser()`). `api/`·정적 파일·이미지는 제외. 환경변수 없으면 통과 | Edge |
| `lib/data.ts` | `server-only` 조회 함수 + 타입 `Tree`·`OrnamentRow`·`Stats` + 데모 데이터 + `demoMode` | 서버 |
| `lib/supabase/server.ts` | `isConfigured`, `createClient()` (세션·RLS), `createAdminClient()` (service role) | 서버 |
| `lib/supabase/client.ts` | `"use client"` 브라우저 클라이언트 (로그인 버튼, 편지 신고) | 브라우저 |
| `lib/constants.ts` | `REVEAL_AT`(UI 표시용), `SITE_NAME`·`SITE_URL`, `ORNAMENTS`·`PROFESSOR_ORNAMENTS`·`DEPARTMENTS`·`THEMES`, `findOrnament`·`isValidOrnament`·`deptOrnament` | 공용 |
| `lib/season.ts` | `getSeason(now, revealAt, forcedDaysLeft)` → 전구 수(12/1~12/24 하루 1개, 총 24)·D-day, `parseForcedDday` | 공용 |
| `lib/moderation.ts` | `hasBannedWord()` 금칙어 | 서버 |
| `components/*.tsx` | 전부 `"use client"`. 트리 화면(`TreeScene`·`TreeView`·`WriteForm`·`LetterModal`·`Snow`·`Countdown`·`ShareButtons`)과 폼(`TreeForm`·`LoginButtons`·`ClaimForm`·`AdminCreateForm`) | 브라우저 |
| `supabase/migrations/0001_init.sql` | 스키마·RLS·RPC 전체. **SQL Editor로 적용** (Supabase CLI 안 씀) | DB |
| `scripts/test-rls.sql` | RLS 테스트. `auth` 스키마를 지우고 다시 만들므로 **빈 로컬 Postgres 전용** | DB |
| `scripts/sync-plan.mjs` | 타임라인 → plan.md 작업 목록 생성 | Node |
| `public/` | 정적 에셋. 장식 SVG는 `public/ornaments/<id>.svg` (**C4**) | 정적 |

### 데이터 접근 규칙 (어떤 클라이언트를 어디서 쓰나)
| 상황 | 사용 | 이유 |
| --- | --- | --- |
| 서버 컴포넌트에서 조회 | `lib/data.ts`의 함수 (내부에서 `createClient()`) | RLS가 사용자 권한대로 걸러 줌. 페이지에서 Supabase를 직접 부르지 않음 |
| 폼 제출·변경 | `app/actions.ts`의 서버 액션 (`createClient()`) | 권한은 RLS·RPC가 판단. 변경 후 `revalidatePath()` |
| 익명 편지 저장 | `app/api/letters` → `createAdminClient()` | `letters`는 anon·authenticated에 INSERT 권한이 없음 (의도된 설계) |
| 브라우저 | `lib/supabase/client.ts` — 로그인 시작(`LoginButtons`)과 주인의 편지 신고 `rpc("report_letter")`(`TreeView`)에서만 | 그 밖의 조회·변경은 브라우저에서 하지 않음 |

- **`select('*')` 금지**: `trees`는 컬럼 단위 권한(`claim_code` 숨김)이라 `*`가 실패합니다. `TREE_COLUMNS` 상수를 씁니다. `letters`도 필요한 컬럼만 고릅니다 (`ip_hash`·`client_hash`는 절대 내보내지 않음).
- **장식 목록은 RPC**: 방문자용 장식은 `rpc("get_ornaments", { p_tree_id })` — 본문·고백 여부를 뺀 `OrnamentRow`만 돌려줍니다. `letters`를 직접 조회해 장식을 만들지 않습니다.
- **편지 본문**: `getLetters()`는 RLS가 "트리 주인 + `is_revealed()` + 숨김 아님"일 때만 행을 돌려주고, 그 외에는 빈 배열입니다. 앱 코드에서 날짜로 거르지 않습니다.
- **기존 RPC**: `get_ornaments`, `get_stats`(트리·편지·고백·오늘 수), `report_letter`, `claim_tree(p_code)`→slug, `admin_set_claim_code`, `admin_resolve_report`, `admin_list_special_trees`, 헬퍼 `is_revealed()`·`is_admin()`. 관리자 함수는 함수 안에서 `is_admin()`을 확인합니다.
- **새 `security definer` 함수**를 만들면 `revoke execute … from public, anon, authenticated` 후 필요한 역할에만 `grant`합니다 (spec.md 5.3).
- **DB 테이블**: `app_config`(단일 행, `reveal_at`), `profiles`(가입 시 트리거로 생성, `is_admin`은 사용자가 못 바꿈), `trees`(일반 유저 1인 1트리, slug `^[a-z0-9-]{4,40}$`), `letters`. 컬럼은 spec.md 5.3.

### 확정된 변경 (구현 전이면 현재 코드와 다름)
| 항목 | 지금 코드 | 바뀔 모습 | 작업 |
| --- | --- | --- | --- |
| 편지 저장 | API가 `count` 쿼리 2번 후 INSERT (동시 요청에 취약), IP만 기준 | `0002_submit_letter.sql`: `letters.client_hash` + `submit_letter(...)` 한 트랜잭션. API는 검증 → `anon_id` 쿠키(없으면 발급, httpOnly) → IP·브라우저 ID를 `IP_HASH_SALT`로 sha256 → RPC 1회 → 제한 오류를 `429`로 변환 | **S11**, **S12** |
| 작성 제한 | IP 기준 분당 5 · 트리당 하루 10 | 브라우저 분당 5 · 트리당 하루 10, IP 분당 30 (베타에서 조정) | **S11**, **S12** |
| 폰트 | Google Fonts `<link>` | `next/font/google` (Jua, Gowun Dodum) → CSS 변수로 `@theme`에 연결 | **F3** |
| 스토리 이미지 저장 | `html-to-image` → `<a download>` | 캡처는 그대로, `navigator.share({ files })` → 안 되면 이미지를 띄워 "길게 눌러 저장" | **C7** |
| OG | `metadata.openGraph` 텍스트만 | 정적 `app/opengraph-image.png` 1장 | **F2** |
| 장식 아이콘 | 이모지 (`Ornament.emoji`) | `public/ornaments/<id>.svg`, id는 그대로 | **C4** |
| CI | 없음 | GitHub Actions: lint · typecheck · build + Postgres 서비스 컨테이너에서 `test-rls.sql` | **S13** |
| 관측 | 없음 | Vercel Analytics, (선택) Sentry | **S15** |
| 카카오톡 공유 | 링크 복사·Web Share | (선택) Kakao JS SDK, `lib/kakao.ts` | **C11** |

`POST /api/letters`의 요청·응답 형식은 바뀌지 않습니다 (spec.md 5.2). **하지 않기로 한 것**은 쓰지 않습니다: Turnstile, `next/og`, Supabase CLI, Playwright, Firebase, 별도 백엔드, Upstash Redis, 애니메이션 라이브러리.

### 인증
- 공급자: 카카오·구글 OAuth (`signInWithOAuth`, `redirectTo` = `/auth/callback?next=…`). 코드에는 이메일 OTP 로그인도 있음 (`signInWithOtp`).
- 세션은 쿠키. `middleware.ts`가 갱신하고, 서버 컴포넌트에서는 `createClient()`의 `setAll` 실패를 무시합니다 (정상).
- 로그인 필요 페이지는 서버에서 `getUser()`로 확인 후 `redirect("/login?next=…")`.
- 관리자 = `profiles.is_admin = true` (대시보드에서 직접 지정). 화면 분기는 `getProfile()`, 실제 권한은 RLS·RPC.
- OAuth 앱 등록과 Supabase 리다이렉트 URL 설정은 사람이 합니다 (**S2**).

### 데모 모드
- `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`가 없으면 `isConfigured = false` → `demoMode = true`.
- `lib/data.ts`가 데모 트리(`/t/demo`, `/t/prof-demo`)와 가짜 장식·통계를 돌려주고, `/api/letters`는 검증만 하고 `{ ok: true, demo: true }`.
- 새 조회 함수를 만들면 **데모 분기(`if (!isConfigured) return …`)도 함께** 넣어 데모 모드가 깨지지 않게 합니다.
- `?dday=N`(0~60)은 개발·데모 모드에서만 연출을 바꾸며 열람 권한과 무관합니다.

### 환경변수 (`.env.local`, Vercel 동일 · 예시는 `.env.example`)
| 이름 | 범위 | 쓰는 곳 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 | `lib/supabase/*`, `middleware.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** | `createAdminClient()` → `app/api/**`에서만 |
| `IP_HASH_SALT` | **서버 전용** | `/api/letters` 해시 |
| `NEXT_PUBLIC_SITE_URL` | 공개 | `SITE_URL` (공유 링크, `metadataBase`) |
| `NEXT_PUBLIC_REVEAL_AT` | 공개 | `REVEAL_AT` 표시용 기본값. 실제 공개는 DB `app_config.reveal_at` |
| `NEXT_PUBLIC_KAKAO_JS_KEY`, `NEXT_PUBLIC_SENTRY_DSN` | 공개 | (선택) C11, S15 |

`NEXT_PUBLIC_` 없는 값은 클라이언트 컴포넌트에서 읽지 않습니다. 키 값을 코드·문서·커밋에 넣지 않습니다.

### 스타일·연출
- Tailwind v4 유틸리티 + `app/globals.css`의 공용 클래스: `.card`, `.btn` / `.btn-primary` / `.btn-light` / `.btn-ghost`, `.font-display`.
- 토큰(`@theme`): `--font-sans`(Gowun Dodum), `--font-display`(Jua), `--color-pine #1f7a45`, `--color-berry #c8102e`, `--color-cream #fff8ec`. 배경 `#0f2a44`. 디자인 확정(**D2**) 후 이 토큰을 바꿉니다.
- 애니메이션은 CSS `@keyframes`(`sway`, `pop-in`, `twinkle`, `sleigh`, `cry`, `shake`)와 `canvas-confetti`만 씁니다.
- 모바일 우선 (`min-h-dvh`, `maximumScale: 1`). 대부분 인앱 브라우저라 `download` 속성·팝업·서드파티 쿠키에 기대지 않습니다.
- 장식 id(`lib/constants.ts`)는 DB에 저장되므로 **바꾸거나 지우지 않고** 추가만 합니다. 학과 장식은 `dept-<학과id>`.

### 꼭 지킬 제약 (CLAUDE.md와 같음)
1. 편지 본문 공개는 DB RLS(`is_revealed()`)가 강제합니다. 클라이언트 시간·`REVEAL_AT`으로 열람을 판단하지 않습니다.
2. `is_confession`은 공개 전 어떤 응답에도 넣지 않습니다 (홈 집계 숫자만).
3. `SUPABASE_SERVICE_ROLE_KEY`·`createAdminClient()`는 `app/api/**`의 서버 코드에서만.
4. 프론트엔드는 `app/actions.ts`·`lib/data.ts`를 호출만 합니다. 함수 이름·인자·반환 타입이 바뀌면 spec.md 2.2부터 고칩니다.

### 명령어와 검증
```bash
npm install          # 처음 한 번
npm run dev          # http://localhost:3000 (환경변수 없으면 데모 모드)
npm run build        # 커밋 전 필수
npm run lint         # 커밋 전 필수
npm run typecheck    # 커밋 전 필수 (tsc --noEmit)
```
- DB를 바꿨으면: 빈 로컬 Postgres에서 `psql -d <빈DB> -f supabase/migrations/0001_init.sql`(및 새 마이그레이션) 적용 후 `psql -d <빈DB> -f scripts/test-rls.sql`. 새 권한 규칙은 `test-rls.sql`에 케이스를 추가합니다. **Supabase 프로젝트에는 절대 돌리지 않습니다.**
- 화면을 바꿨으면 데모 모드에서 `/`, `/t/demo`, `/t/prof-demo`, `/t/demo?dday=7`, `/?dday=0`을 모바일 폭(375px)으로 확인합니다.
- 자동 E2E 테스트는 없습니다. 실기기·인앱 브라우저 확인은 사람이 합니다 (**C1**, **C2**).

### 작업 규칙 요약
- 브랜치 `task/<번호>-<짧은-설명>`, 커밋 `<번호>: <요약>`. 푸시·PR은 요청받을 때만.
- UI 문구·에러 메시지·주석은 한국어. 에러는 사용자에게 다정한 문장으로 (예: "루돌프가 숨 고르는 중이에요").
- 사용자 입력은 서버에서 다시 자르고 검증합니다 (`trim().slice(0, n)`, DB `check` 제약과 같은 길이).
- 마이그레이션은 새 번호 파일(`0002_…`)로 추가하고 기존 파일은 고치지 않습니다. 재실행해도 안전하게 `if not exists`·`create or replace`·`drop policy if exists`를 씁니다.

---

<!-- timeline:start -->
<!-- 타임라인에서 생성됨 (2026-11-14). 손으로 고치지 말고 타임라인을 고친 뒤 scripts/sync-plan.mjs를 실행하세요. -->

> 타임라인 동기화: 2026-11-14 · 작업 46개 중 1개 완료 · ⭐ 핵심 작업

## 🎨 디자인 · (담당 미정)
> 아이덴티티, 일러스트, 아이콘, 공유 이미지
### ~11/19 M1 시안·실서버
- [ ] **D1** 에셋 전달 규칙 합의 · 11/13(금) ⭐
  - 아이콘 파일 이름을 장식 ID와 같게 맞춰요. 예: public/ornaments/ball-red.svg. 그래야 클라이언트가 코드에 바로 끼울 수 있어요.
  - 할 일
    - lib/constants.ts의 장식 ID 목록 공유 (기본 10, POSTECH 10, 학과 16, 교수님 4)
    - 장식 아이콘: public/ornaments/<장식ID>.svg
    - 포닉스: public/ponix.svg
    - SVG는 정사각 viewBox, 배경 투명
    - 색·폰트는 토큰 이름으로 전달 (--color-berry 등)
  - 산출물: 파일 이름 규칙 (plan.md에 기록)
  - 완료 기준: 디자인·클라이언트가 규칙을 확인함
- [ ] **D2** 컬러·폰트·로고 확정 · 11/13(금)–11/16(월)
  - 현재 시안: 남색 배경 + 포스텍 레드, Jua / Gowun Dodum.
  - 할 일
    - 팔레트 4~6색
    - 제목·본문 폰트
    - 로고/타이틀 '포스텍 트리'
  - 산출물: 디자인 토큰 표, 로고 SVG
  - 완료 기준: 팀이 토큰 이름과 값에 합의
- [ ] **D3** 트리 일러스트·D-day 단계 시안 · 11/14(토)–11/19(목) · 선행: D2
  - 12/1부터 전구가 하루 1개씩 켜지고 눈이 쌓이는 연출의 단계별 그림.
  - 할 일
    - 불 꺼진 트리 (12/1 이전)
    - 중간 (전구 절반, 눈 조금)
    - D-3 (선물 상자 등장)
    - 크리스마스 (전구 전부, 눈 수북)
  - 산출물: 단계별 시안 4장, 트리 SVG
  - 완료 기준: 클라이언트가 레이어 구조를 확인함
- [ ] **D5** 편지지·봉투 디자인 · 11/17(화)–11/19(목) · 선행: D2
  - 할 일
    - 편지지 배경
    - 봉투 닫힘/열림
    - 고백 편지 변형 (공개 후 표시)
  - 산출물: 편지지·봉투 SVG
### ~11/26 M2 반영·배포
- [ ] **D4** 장식 아이콘 SVG 세트 (40종) · 11/16(월)–11/21(토) · 선행: D1, D2
  - 현재 이모지를 대체. D1 파일 이름 규칙을 따라 전달.
  - 할 일
    - 기본 장식 10
    - POSTECH 장식 10
    - 학과 장식 16
    - 교수님 장식 4
  - 산출물: public/ornaments/*.svg 40개
  - 완료 기준: 파일 이름이 장식 ID와 모두 일치
- [ ] **D7** 화면 디자인 (홈·로그인·내 페이지·관리자) · 11/19(목)–11/24(화) · 선행: D2
  - 할 일
    - 홈 (카운트다운, 고백 카운터, 통계)
    - 로그인
    - 내 페이지
    - 관리자
  - 산출물: 화면 시안
- [ ] **D6** 포닉스 캐릭터 · 11/20(금)–11/22(일) · 선행: D2
  - 학교 공식 캐릭터를 쓰려면 사용 허락이 필요. 아니면 오리지널 불새.
  - 할 일
    - 기본 포즈
    - 탭했을 때 반응 포즈
  - 산출물: public/ponix.svg
- [ ] **D8** 교수님 칠판 테마 · 11/22(일)–11/23(월) · 선행: D2
  - 할 일
    - 칠판 배경
    - 분필 장식
  - 산출물: 테마 시안
- [ ] **D9** OG 썸네일·스토리 캡처 영역 디자인 · 11/23(월)–11/25(수) · 선행: D3
  - 할 일
    - 링크 미리보기 1200×630 (모든 트리 공통 1장)
    - 스토리 캡처 영역 레이아웃 (제목·트리·안내 문구)
  - 산출물: OG 이미지, 스토리 템플릿
### ~12/1 오픈
- [ ] **D10** 오픈 공지 이미지 · 11/27(금)–11/30(월) · 선행: D9
  - 할 일
    - 인스타 게시물
    - 인스타 스토리
  - 산출물: 공지 이미지

## 🖥 프론트엔드 · 와장창프론트엔드
> 홈·로그인·생성·내 페이지·관리자 화면, 디자인 반영, OG·폰트
### ~11/19 M1 시안·실서버
- [ ] **F4** 서버와 경계 합의·실서버 화면 흐름 · 11/16(월)–11/19(목) · 선행: S2
  - 프론트엔드는 app/actions.ts·lib/data.ts를 호출만 하고, 쿼리·권한·API는 서버가 맡음. spec.md 2장.
  - 할 일
    - 화면별로 필요한 서버 액션·조회 함수 목록을 spec.md 2.2-5에 정리
    - 서버가 준 .env.local로 로그인 → 트리 생성 → 내 페이지 흐름 확인
    - 오류 문구·로딩 상태 점검
  - 산출물: spec.md 2.2 계약 목록
  - 완료 기준: M1 통과
### ~11/26 M2 반영·배포
- [ ] **F3** next/font 교체·framer-motion 제거 · 11/20(금)
  - Jua, Gowun Dodum을 자체 호스팅.
  - 할 일
    - app/layout.tsx의 <link> 제거
    - framer-motion 의존성 제거
- [ ] **F1** 페이지 디자인 반영 · 11/22(일)–11/26(목) · 선행: D7
  - 할 일
    - 홈
    - 로그인
    - 내 페이지
    - 관리자
  - 완료 기준: M2 통과
- [ ] **F2** 정적 OG 이미지·메타데이터 · 11/25(수)–11/26(목) · 선행: D9
  - 모든 트리가 같은 OG 이미지 1장을 씀.
  - 할 일
    - app/opengraph-image.png 추가
    - 카톡·인스타 링크 미리보기 확인
    - 페이지 메타데이터 정리 (app/layout.tsx, app/t/[slug]/page.tsx의 generateMetadata)
### ~12/1 오픈
- [ ] **F5** 베타 페이지·폼 버그·접근성 · 11/29(일)–11/30(월) · 선행: T3
  - 할 일
    - 베타 피드백 중 페이지·폼 버그 수정
    - 폼 라벨·에러 문구·키보드 이동 (홈·로그인·내 페이지·관리자)

## 🛠 서버 · (담당 미정)
> DB·RLS·API·로그인(OAuth)·배포·CI
### ~11/19 M1 시안·실서버
- [ ] **S1** Supabase 생성·0001 적용 · 11/13(금)–11/15(일)
  - SQL Editor로 supabase/migrations/0001_init.sql 적용.
  - 할 일
    - 프로젝트 생성
    - SQL Editor로 0001_init.sql 적용
  - 산출물: 실서버 DB
  - 완료 기준: 테이블·RLS·RPC 생성 확인
- [ ] **S2** 카카오·구글 OAuth 등록 · 11/14(토)–11/17(화) · 선행: S1
  - 카카오는 'Allow users without an email' 켜기.
  - 할 일
    - 카카오 개발자 앱
    - 구글 OAuth 클라이언트
    - Supabase Provider 설정
  - 산출물: 로그인 동작
- [ ] **S11** submit_letter() 마이그레이션·RLS 테스트 · 11/15(일)–11/17(화) · 선행: S1 ⭐
  - 검증·작성 제한·저장을 DB 함수 하나에서 한 트랜잭션으로 처리. spec.md 5.3.
  - 할 일
    - 0002_submit_letter.sql: letters.client_hash 컬럼·인덱스
    - submit_letter() 함수 (security definer)
    - revoke execute from public, anon, authenticated + grant execute to service_role
    - scripts/test-rls.sql에 service_role 역할·0002·테스트 추가
    - 빈 Postgres DB에서 실행 (Supabase DB에서 실행 금지)
  - 산출물: supabase/migrations/0002_submit_letter.sql
  - 완료 기준: anon·authenticated는 호출 실패, service_role은 성공, 제한 초과 시 거부
- [ ] **S12** /api/letters를 submit_letter()로 교체 · 11/17(화)–11/18(수) · 선행: S11
  - 요청·응답 형식은 그대로라 WriteForm은 고칠 필요 없음. spec.md 4.4, 5.2.
  - 할 일
    - anon_id 쿠키 발급 (httpOnly)
    - client_hash 계산
    - 기존 개수 조회 + INSERT를 submit_letter() 1회 호출로 교체
  - 완료 기준: 브라우저 분당 5개, IP 분당 30개 제한 동작
- [ ] **S3** 실서버 전체 흐름 확인 · 11/17(화)–11/19(목) · 선행: S2, S12
  - 할 일
    - 로그인 → 트리 생성
    - 친구 편지 작성 (submit_letter()로 저장되는지)
    - reveal_at 조작해 열람 확인 후 원복
    - 프론트엔드·클라이언트에 환경변수 전달 (비밀 키 제외)
  - 산출물: .env.local
  - 완료 기준: M1 통과
- [ ] **S13** GitHub Actions CI · 11/18(수)–11/19(목) · 선행: S11
  - 할 일
    - lint · typecheck · build
    - Postgres 서비스 컨테이너에서 scripts/test-rls.sql
    - 실패하면 머지 금지
  - 산출물: .github/workflows/ci.yml
  - 완료 기준: M1 통과
### ~11/26 M2 반영·배포
- [ ] **S4** 도메인·Vercel 배포·환경변수 · 11/19(목)–11/21(토) · 선행: S3
  - 할 일
    - 도메인 결정·구매 → Vercel 연결
    - 환경변수 (spec.md 1.1 표)
    - Supabase Redirect URL 추가
    - PR Preview 배포 확인
    - (선택) 카카오 공유용 Kakao Developers 도메인 등록
  - 산출물: 배포 URL
- [ ] **S15** Vercel Analytics · (선택) Sentry · 11/21(토)–11/22(일) · 선행: S4
  - 인앱 브라우저 오류는 사용자가 신고해 주지 않으므로 Sentry가 있으면 좋음.
  - 할 일
    - Vercel Analytics 켜기
    - (선택) Sentry 연동 (instrumentation.ts)
    - Supabase 사용량·일시정지 상태 확인 (무료 플랜은 약 1주일 미사용 시 일시정지)
### ~11/29 M3 베타
- [ ] **S7** 관리자·교수님 트리 준비 · 11/24(화)–11/27(금) · 선행: S4
  - 할 일
    - 관리자 계정 지정
    - 교수님 트리 생성
    - 초대 코드 전달
### ~12/1 오픈
- [ ] **S8** 베타 피드백 반영 · 11/29(일)–11/30(월) · 선행: T3
  - 할 일
    - 학교망·기숙사 와이파이 IP 공유 여부 확인 → 작성 제한 숫자 확정
    - 금칙어 보강
    - 도배가 생기면 Turnstile 추가 검토
### ~12/24 리허설
- [ ] **S9** 공개 리허설 · 12/24(목)
  - 테스트 트리로 reveal_at을 당겨 열람 확인 후 원래 시각으로 복구.
### 이후
- [ ] **S10** 공개 모니터링 · 12/25(금)–12/26(토) · 선행: S9
  - 할 일
    - 접속량·오류 확인
    - 신고 처리

## 📱 클라이언트 · 람쥐썬더
> 트리 화면 인터랙션, 연출, 실기기 QA
### ~11/19 M1 시안·실서버
- [ ] **C1** 인앱 브라우저 QA (인스타·카톡) · 11/13(금)–11/17(화)
  - 대부분 인스타 링크로 들어오므로 가장 먼저.
  - 할 일
    - 링크 열기
    - 공유 버튼
    - 이미지 저장
    - navigator.share({ files }) 지원 여부 (iOS·Android)
    - 키보드가 입력창을 가리는지
  - 산출물: 이슈 목록 (client 라벨)
- [ ] **C2** 실기기·성능 QA · 11/16(월)–11/19(목)
  - 할 일
    - iOS Safari
    - Android Chrome
    - 저사양 폰 애니메이션 (전구·눈·흔들림)
- [ ] **C3** 장식 많을 때 페이지 넘김 UX · 11/17(화)–11/19(목)
  - 한 화면에 18개, 넘으면 페이지 넘김.
### ~11/26 M2 반영·배포
- [ ] **C5** 트리 일러스트·편지지 반영 · 11/20(금)–11/24(화) · 선행: D3, D5
  - 할 일
    - TreeScene에 단계별 일러스트
    - LetterModal 편지지·봉투
- [ ] **C4** 장식 아이콘 SVG 반영 · 11/21(토)–11/24(화) · 선행: D1, D4
  - 이모지 → public/ornaments/<장식ID>.svg.
  - 할 일
    - findOrnament가 이미지 경로를 쓰도록 변경
    - 이모지 fallback 유지
  - 완료 기준: 40종 모두 표시
- [ ] **C6** 포닉스 교체 · 11/23(월)–11/24(화) · 선행: D6
- [ ] **C7** 스토리 이미지 저장 방식 개선 · 11/25(수)–11/26(목) · 선행: D9, C1
  - html-to-image 캡처는 유지하고, 인앱 브라우저에서 막히는 <a download> 대신 공유 시트로 넘김.
  - 할 일
    - navigator.share({ files })로 공유
    - 안 되면 이미지를 띄워 "길게 눌러 저장" 안내
    - TreeView의 captureRef 영역을 디자인대로 다듬기
  - 완료 기준: M2 통과
- [ ] **C11** (선택) 카카오톡 공유 버튼 · 11/25(수)–11/26(목) · 선행: S4
  - M2 여유가 있을 때. 등록한 도메인에서만 동작.
  - 할 일
    - Kakao JS SDK (lib/kakao.ts)
    - 공유 카드에 OG 이미지 사용
### ~11/29 M3 베타
- [ ] **C8** 편지 열기 연출 다듬기 · 11/26(목)–11/28(토) · 선행: C5
  - 할 일
    - 봉투 → 편지 전환
    - 여러 통 연속 읽기
- [ ] **C9** 접근성 · 11/27(금)–11/28(토)
  - 할 일
    - 버튼 포커스
    - aria-label
    - prefers-reduced-motion
### ~12/1 오픈
- [ ] **C10** 베타 버그 수정 · 11/29(일)–11/30(월) · 선행: T3

## 👥 공통 · 모두
> 베타, 공지, 운영
### ~11/19 M1 시안·실서버
- [ ] **T1** GitHub Issues 라벨 운영 시작 · 11/13(금)
  - 라벨: design / frontend / server / client
- [x] **T7** 기술 스택 확정 · 11/14(토)
  - 기존 코드 유지 + 출시 전 위험 3가지만 수정. spec.md 1.1.
  - 할 일
    - 스토리 이미지 저장 방식
    - 브라우저 ID + IP 작성 제한
    - submit_letter() 원자 처리
  - 산출물: spec.md 1.1, plan.md
- [ ] **T8** 서버 담당자 정하기 · 11/15(일)
  - 프론트엔드와 서버를 나눴으므로 서버 담당자 별명을 정해 spec.md 2장과 이 타임라인 담당자 칸에 적기.
### ~11/29 M3 베타
- [ ] **T2** 베타 테스터 모집 · 11/24(화)–11/28(토)
  - 할 일
    - 지인 10명
### ~12/1 오픈
- [ ] **T3** 베타 테스트 · 11/29(일)–11/30(월) · 선행: S4, C4, T2
  - 할 일
    - 트리 만들기
    - 편지 쓰기
    - 인앱 브라우저에서 공유
    - 학교망에서 작성 제한 확인
  - 산출물: 버그 목록
  - 완료 기준: M3 통과
- [ ] **T4** 오픈 공지 · 12/1(화) · 선행: D10
  - 할 일
    - 인스타 게시물·스토리
### ~12/24 리허설
- [ ] **T5** 운영: 전구 점등·편지 수집 · 12/2(수)–12/23(수) · 선행: T4
  - 매일 전구가 하나씩 켜지는 기간. 신고·문의 대응.
### ~12/25 편지 공개
- [ ] **T6** 편지 공개 · 12/25(금) · 선행: S9
  - 12/25 0시 KST

<!-- timeline:end -->

## 타임라인에 아직 없는 작업
> 타임라인을 고칠 수 없는 사람·세션이 찾은 작업을 여기에 적고, 타임라인 편집 권한이 있는 사람이 번호를 붙여 옮깁니다. 옮긴 뒤에는 여기서 지웁니다.

- (없음)
