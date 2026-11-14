# 포스텍 트리 — 제품 스펙

> 마지막 갱신: 2026-11-14 (프론트엔드·서버 역할 분리: 2장 · 기술 스택 확정: 1.1, 3, 4, 5, 6장) · 작업을 시작하기 전에 이 문서를 먼저 고치고, 구현 단계는 [`plan.md`](./plan.md)에 체크리스트로 남깁니다.

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
| CI | GitHub Actions — lint · typecheck · build + 빈 Postgres 컨테이너에서 `scripts/test-rls.sql` | **신규** (기존 스크립트 그대로 사용) |
| 관측 | Vercel Analytics (유입) · Sentry (오류, **선택**) | **신규** |
| 도메인 | 고정 도메인 구매 권장 (연 1~2만 원) | **신규** (6장 결정 필요) |
| 제거 | `framer-motion` (설치만 되어 있고 미사용) | |

**지금은 하지 않고, 필요해지면 추가** (6장)
- Cloudflare Turnstile 봇 방어 — 도배가 실제로 생기면 (인앱 브라우저에서 실패하면 편지를 못 쓰게 되는 위험이 있어 보류)
- 트리별 OG 이미지 · 서버 생성 스토리 이미지(`next/og`) — 트리를 따로 다시 그려야 하고 화면 상태(포닉스 등)를 잃음
- Supabase CLI · Playwright E2E — 운영 기간이 짧고 마이그레이션이 2개뿐. 베타 수동 테스트로 대체

**쓰지 않기로 한 것**: Firebase (행 단위 공개 규칙을 짜고 테스트하기 어려움), 별도 백엔드 서버 (운영 부담), 네이티브 앱 (인스타 링크에서 바로 써야 함), Upstash Redis (Postgres 함수로 충분)

**환경변수** (`.env.local`, Vercel 동일)

| 이름 | 공개 여부 | 용도 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 | Supabase 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** | `submit_letter()` 호출 |
| `IP_HASH_SALT` | **서버 전용** | IP·브라우저 ID 해시 솔트 |
| `NEXT_PUBLIC_SITE_URL` | 공개 | 공유 링크·OG 기준 주소 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 공개 | (선택) 카카오톡 공유 |
| `NEXT_PUBLIC_SENTRY_DSN` | 공개 | (선택) 오류 수집 |

**비용**: 도메인 외 0원 (Vercel Hobby는 비상업 용도 한정, Supabase Free는 약 1주일 미사용 시 일시정지되니 개발 공백 주의)

## 2. 팀과 역할

| 역할 | 담당 | 한 줄 정의 |
| --- | --- | --- |
| 디자인 | (별명 미정) | 비주얼 아이덴티티, 일러스트, 아이콘, 공유 이미지 |
| 프론트엔드 | 와장창프론트엔드 | 트리 화면 밖의 페이지 구성·라우팅·폼 (홈, 로그인, 트리 생성, 내 페이지, 관리자), 디자인 반영, 메타데이터·OG·폰트 |
| 서버 | (별명 미정) | DB·RLS·API·인증(OAuth)·미들웨어·배포·CI·모니터링 |
| 클라이언트 | 람쥐썬더 | 트리 화면의 렌더링과 인터랙션 (애니메이션, D-day 연출, 이스터에그, 편지 작성·열람 UI, 공유) |

**프론트엔드와 서버의 경계**: 프론트엔드는 `app/actions.ts`의 서버 액션과 `lib/data.ts`의 조회 함수를 **호출만** 하고, 쿼리·권한·RLS·API 구현은 서버가 맡는다. 화면에 필요한 데이터나 액션이 새로 생기면 프론트엔드가 2.2의 계약에 먼저 적고 서버에 요청한다.

### 2.1 소유 파일 맵
누가 고쳐도 되지만, **소유자가 리뷰**한다.

| 영역 | 소유 | 파일 |
| --- | --- | --- |
| 트리 화면 / 인터랙션 | 클라이언트 | `components/TreeScene.tsx`, `TreeView.tsx`, `WriteForm.tsx`, `LetterModal.tsx`, `Snow.tsx`, `Countdown.tsx`, `ShareButtons.tsx`, `lib/season.ts`, `app/globals.css` (애니메이션 부분) |
| 카카오톡 공유 (선택) | 클라이언트 | `lib/kakao.ts` |
| 페이지 / 폼 | 프론트엔드 | `app/**/page.tsx`, `app/layout.tsx`, `app/not-found.tsx`, `app/opengraph-image.png`, `components/TreeForm.tsx`, `LoginButtons.tsx`, `ClaimForm.tsx`, `AdminCreateForm.tsx`, `package.json` (프론트엔드 의존성) |
| 데이터 / 서버 | 서버 | `app/actions.ts`, `app/api/**`, `app/auth/**`, `middleware.ts`, `lib/data.ts`, `lib/supabase/**`, `lib/moderation.ts`, `supabase/migrations/**`, `scripts/test-rls.sql`, Vercel·Supabase 설정 |
| CI / 관측 | 서버 | `.github/workflows/**`, (선택) `sentry.*.config.ts`, `instrumentation.ts` |
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
- 필요해지면 추가 (1.1): Turnstile 봇 방어, 트리별 OG·서버 생성 스토리 이미지, Supabase CLI, Playwright E2E
- 크리스마스 이후 서비스 종료/보관 정책
- 범위 밖: 모바일 네이티브 앱, 실시간 알림, 편지 답장
