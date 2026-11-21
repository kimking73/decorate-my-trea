# 포스텍 트리 — 제품 스펙

> 마지막 갱신: 2026-11-21 (F4 서버 경계 점검: 2.3 화면별 실제 호출·오류 계약, 5.1 일시적 오류 화면, 2.1 `app/error.tsx` · 7장 타임라인 링크를 실제 주소로 교체 · F6 화면 구조 정리: 2.1에 프론트엔드 새 컴포넌트 · 와이어프레임 반영: 교수님 관심(하트)·허락 흐름, 내 트리 색·테마, 하트·허락 4.6, 내 트리 꾸미기 4.7, 화면별 데이터·액션 2.3, 화면 5.1, DB 5.3, 미정 6장) · 2026-11-17 (애니메이션 성능 규칙·동작 줄이기(C2): 4.2, 2.1 · 데모 전용 주인 화면 미리보기 `?owner=1`: 4.2 · 장식 페이지 넘김(C3): 5.1 · 12/25 0시 동시 접속 대비: 4.5, 6장 · 서버 담당: 2장 · 문서 간 중복 제거·환경변수 표 통합: 1.1, 7장 · QA용 데모 배포·공유 주소 기본값: 1.1 · plan.md 기술 스택 작업 가이드 규칙: 7장 · 작업 관리 규칙 추가: 7장 · 프론트엔드·서버 역할 분리: 2장 · 기술 스택 확정: 1.1, 3~6장) · 작업을 시작하기 전에 이 문서를 먼저 고치고, 구현 단계는 [`plan.md`](./plan.md)에 체크리스트로 남깁니다.

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
| 페이지 / 폼 | 프론트엔드 | `app/**/page.tsx`, `app/**/loading.tsx`, `app/layout.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/opengraph-image.png`, `components/TreeForm.tsx`, `LoginButtons.tsx`, `ClaimForm.tsx`, `AdminCreateForm.tsx`, (새로) `ProfessorList.tsx`, `TreeStyleForm.tsx`, `Toast.tsx`, `ShareLinkButtons.tsx`, `InAppNotice.tsx`, `ConfirmSubmitButton.tsx`, `LoadingSkeleton.tsx`, `package.json` (프론트엔드 의존성) |
| 데이터 / 서버 | 서버 | `app/actions.ts`, `app/api/**`, `app/auth/**`, `middleware.ts`, `lib/data.ts`, `lib/supabase/**`, `lib/moderation.ts`, `supabase/migrations/**`, `scripts/test-rls.sql`, Vercel·Supabase 설정 |
| CI / 관측 | 서버 | `.github/workflows/**`, (선택) `sentry.*.config.ts`, `instrumentation.ts` |
| 작업 관리 | 공통 | `plan.md`, `scripts/sync-plan.mjs` (7장) |
| 디자인 토큰 / 에셋 | 디자인 (코드 반영은 클라이언트) | `app/globals.css`의 `@theme`, `lib/constants.ts`의 `ORNAMENTS`·`THEMES`, `public/` |

### 2.2 팀 간 계약 (바꾸려면 이 문서를 먼저 수정하고 상대에게 공유)
1. **데이터 타입**: `lib/data.ts`의 `Tree`, `OrnamentRow`, `Stats`
2. **컴포넌트 props**: `TreeScene` (`theme`, `ornaments`, `season`, `onOrnamentClick`, `starMode`, `crying`, `lockedIcons`), `TreeView` (`tree`, `ornaments`, `letters`, `isOwner`, `isLoggedIn`, `season`, `revealAt`, `shareUrl`, `justAdded`, `egg`, `demo`)
   - **추가 예정**: `TreeScene`에 `treeColor?: string` (트리 색 id, 없으면 `theme` 기본색). 홈·`/create`·`/me/style` 미리보기도 `TreeScene`을 재사용한다 (4.7)
3. **API**: 아래 5장 `POST /api/letters`
4. **장식 ID**: `lib/constants.ts`의 장식 `id`는 DB `letters.ornament_type`에 저장된다. **이미 쓰인 id는 바꾸거나 지우지 않는다** (아이콘 이미지만 교체). 트리 색·배경 테마 id(`trees.tree_color`, `trees.theme`)도 같은 규칙이다.
5. **서버 액션·조회 함수** (프론트엔드 ↔ 서버): `app/actions.ts`의 함수 이름·인자·반환값, `lib/data.ts`의 조회 함수 이름·반환 타입. 화면별 목록은 2.3

### 2.3 화면별 데이터·액션 (와이어프레임 기준)
와이어프레임: [포스텍 트리 와이어프레임 (프론트엔드 화면)](https://claude.ai/artifact/48YKQPtn78agRoLiFXwSE5). 화면 구조·문구·상태는 와이어프레임을 따르고, 색·폰트·일러스트는 디자인 시안(D7)을 따른다. "새로 필요"는 서버가 만들고, 이름은 제안이며 서버가 정하면 이 표를 고친다.

| 화면 | 있는 함수 (지금 호출) | 새로 필요 (서버) |
| --- | --- | --- |
| `/` 홈 | `getUser()`, `getStats()`, `getRevealAt()`, `getMyTree()`, `getOrnaments()` (받은 편지 수) | 받은 편지 수: 지금은 `getOrnaments(id).length`. 많아지면 `getLetterCount(treeId)` |
| `/login` | `getUser()` (로그인돼 있으면 `next`로), `LoginButtons` (`signInWithOAuth`), `/auth/callback` 실패 시 `/login?error=1` | - |
| `/create` | `getUser()`, `getMyTree()`, `getProfile()`, `getRevealAt()`, `saveMyTree(FormState, FormData)` (새로 만들기·이름 바꾸기 공용, 이름 최대 20자) | 이름 바꾸기 성공 시 `/t/[slug]` 대신 `/me?toast=renamed`로 이동 (새로 만들기는 지금처럼 `/t/[slug]`) |
| `/me` | `getUser()`, `getMyTree()`, `getOrnaments()`, `getProfile()`, `getRevealAt()`, `POST /auth/signout` | - |
| `/me/style` | `getUser()`, `getMyTree()` | `saveTreeStyle(FormState, FormData)` — `tree_color`·`theme` 저장, 트리 주인만, 성공 시 `/me?toast=styled` |
| `/professors` | `getUser()` | `getProfessors(): Promise<ProfessorRow[]>` (관심순), `toggleProfessorLike(treeId): Promise<{ liked: boolean; count: number } \| { error: string }>` — DB 함수 `list_professors()`·`toggle_professor_like()`는 0003(S20)에 있음 |
| `/t/[slug]` · `/t/[slug]/write` | `getTreeBySlug()`, `getUser()`, `getOrnaments()`, `getRevealAt()`, `getLetters()` (주인일 때만), `POST /api/letters`, 신고는 `TreeView`가 `report_letter` RPC 직접 호출 (클라이언트 소유) | `getTreeBySlug()`가 허락 대기 교수님 트리는 `null` 반환 (4.6) |
| `/admin` 교수님 트리 만들기 | `getUser()`, `getProfile()`, `adminCreateSpecialTree` (`kind=professor` 고정, 허락 대기로 생성) | 실패 문구를 사용자용으로 (아래 오류 계약) |
| `/admin` 교수님 목록 | 페이지가 `admin_list_special_trees` RPC를 직접 호출 | `lib/data.ts`로 옮기기, 반환에 `like_count`·`is_open`·`department` 추가(0003에 있음), `adminSetTreeOpen(FormData)` (DB `admin_set_tree_open()`은 0003에 있음), `adminUpdateSpecialTree(FormState, FormData)` (정보 수정) |
| `/admin` 신고 | 페이지가 `letters`를 직접 조회, `adminResolve(FormData)` | `getReportedLetters()` (`lib/data.ts`로 옮김), `adminResolve`가 실패를 알려 주기 (아래 오류 계약) |

**오류 계약** (F4 점검, 2026-11-21) — 화면이 "없음"과 "불러오지 못함"을 구분해 보여 줄 수 있게 한다. 위 "새로 필요"와 함께 S21에서 서버가 맞춘다.
- **조회 함수**: 없으면 `null`·`[]`, **조회 실패(네트워크·DB 오류)는 throw** → 페이지는 `app/error.tsx`("잠시 문제가 생겼어요")를 보여 준다. 지금은 `getTreeBySlug`·`getMyTree`·`getOrnaments`·`getProfile`이 실패도 `null`·`[]`로 돌려줘서, 장애(특히 12/25 0시) 때 "트리를 찾을 수 없어요"·빈 트리·"아직 트리가 없어요"로 잘못 보인다.
- 예외: `getStats()`·`getRevealAt()`은 지금처럼 기본값으로 대신한다 (홈은 숫자가 틀려도 떠야 한다).
- **서버 액션**: 실패하면 `{ error: "사용자에게 보일 문구" }`. DB 오류 메시지를 그대로 넣지 않는다 (지금 `adminCreateSpecialTree`가 `생성 실패: ${error.message}`). 폼으로 부르는 관리자 액션(`adminResolve`, 새 `adminSetTreeOpen`)도 `FormState`를 돌려줘서 실패를 알릴 수 있게 한다.
- 화면에서 쓰지 않는 함수: `getOwnedSpecialTrees()`, `getSpecialTrees()`, `claimTree`, `adminIssueClaimCode` — 지우지 않고 남긴다 (6장).

- `ProfessorRow = { id, slug, owner_name, department, is_open, like_count, liked_by_me }` — `liked_by_me`는 로그인했을 때만 의미가 있고, 누가 눌렀는지는 돌려주지 않는다.
- 초대 코드(`claimTree`, `adminIssueClaimCode`)는 화면에서 뺀다. 함수와 DB는 지우지 않고 남긴다 (6장).

## 3. 사용자 흐름

### 트리 주인
1. 홈 → 카카오/구글 로그인 → **이름만 입력**해 트리 생성 (트리 이름은 자동으로 "OO님의 트리")
2. 트리 링크 공유 (Web Share / 링크 복사 / 스토리용 이미지, 선택: 카카오톡 공유). 스토리 이미지는 화면의 트리를 캡처해 공유 시트로 넘기고, 공유 시트가 없으면 이미지를 띄워 "길게 눌러 저장"을 안내. `/me`에서도 링크 복사·공유를 할 수 있고, 스토리 이미지는 트리 화면에서만 저장
3. (선택) `/me` → "색·테마 바꾸기"(`/me/style`)에서 트리 색과 배경 테마를 고름 (4.7). "이름 바꾸기"는 `/create`
4. 크리스마스 전: 받은 편지 **개수**만 보이고, 장식을 누르면 "🔒 D-N"
5. 12/25 0시 이후: 장식을 누르면 봉투 애니메이션과 함께 편지 열람. 고백 편지는 이때만 "💘 고백 편지" 라벨 표시. 부적절한 편지는 신고/숨기기

- 홈 위쪽은 상태에 따라 다르다: 로그인 전 "내 트리 만들기"(→ `/login`) · "데모 트리 구경하기" / 로그인·트리 없음 "내 트리 만들기"(→ `/create`) · "데모 트리 구경하기" / 로그인·트리 있음 내 트리 카드(이름·받은 편지 수·D-N) + "내 트리 보러 가기" · "내 트리 링크 공유하기". 헤더와 푸터의 "로그인"은 로그인 후 "내 페이지"로 바뀐다.
- 로그인 화면은 "편지를 쓰는 친구는 로그인이 필요 없다"고 안내한다. 인스타·카톡 인앱 브라우저에서는 Google 로그인이 막힐 수 있어 카카오를 권하고 "이 페이지 링크 복사"로 외부 브라우저를 안내한다.

### 친구 (로그인 없음)
1. 인스타 링크 → 트리 화면 → "트리 꾸며주기" (`/t/[slug]/write`)
2. **1/2 장식 고르기**: 작은 트리 미리보기 + 탭 (기본 / POSTECH / 학과, 교수님 트리면 "교수님 전용" 탭이 맨 앞) → "이 장식으로 편지 쓰기"
3. **2/2 편지 쓰기**: 고른 장식 표시("← 장식 다시 고르기"로 돌아갈 수 있음) + 닉네임(선택, 기본 "익명의 산타") + 편지(1~1000자, 글자 수 표시) + "💘 이 편지는 고백이에요" 체크(선택) → "트리에 달기"
4. 성공하면 `/t/[slug]?added=1`로 돌아가 새 장식이 pop-in. 완료 화면에는 "트리 보러 가기"·"나도 트리 만들기"
5. 실패 문구 (5.2 응답 코드별): `400` 금칙어 "쓸 수 없는 말이 들어 있어요" · 길이 오류 · `404` "트리를 찾을 수 없어요" · `429` "잠시만 쉬었다 써 주세요 — 루돌프가 숨 고르는 중이에요". 입력한 내용은 지우지 않는다.

### 학생 → 교수님 (`/professors`)
1. 홈의 "교수님께 마음 전하기" 카드 → `/professors` (로그인 없이 볼 수 있음)
2. 관심 많은 순으로 교수님 목록(순위·이름·학과·"트리 열림/허락 대기"·관심 수). 이름·학과로 검색
3. 트리가 열린 교수님: "트리 꾸미러 가기" → `/t/[slug]/write` (친구 흐름과 같음)
4. 허락 대기 교수님: 하트로 관심 보내기. 검색 결과에서는 "아직 교수님의 허락을 받지 못했어요. 하지만 관심 버튼을 눌러주시면 도움이 돼요!" 안내
5. 하트는 로그인한 사람만 (4.6). 로그인 안 한 사람이 누르면 그 줄 아래에 로그인 안내 → `/login?next=/professors`

### 교수님 트리 (관리자)
- 관리자가 `/admin` "교수님 트리 만들기" 탭에서 교수님 트리를 **허락 대기** 상태로 만든다 (칠판 테마, 교수님 전용 장식, 학과 선택). 트리 주인은 만든 관리자 계정이다.
- "교수님 목록" 탭에서 관심 수·편지 수를 보고, 교수님께 허락을 받으면 "허락 받음 · 트리 열기"로 연다. 열린 트리는 "트리 보기"·"정보 수정". 상태로 거르기(전체 / 허락 대기 / 트리 열림)
- 초대 코드 발급·입력 화면은 없다 (교수님께 편지를 전하는 방법은 6장).
- 특별 트리(`kind = special`)는 화면에서 만들지 않는다 (DB 값은 유지).

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
- 주인 신고 → 숨김 → 관리자가 복구/삭제 (`/admin` "신고" 탭, 삭제는 한 번 더 확인)

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

### 4.6 교수님 트리 관심(하트)·허락
- **허락 상태는 DB에서 강제**: 허락 대기 트리(`is_open = false`)에는 편지를 달 수 없다. `submit_letter()`가 트리 없음과 같은 오류를 돌려주고(API `404`), `getTreeBySlug()`도 `null`을 돌려 `/t/[slug]`는 "트리를 찾을 수 없어요"를 보여 준다. 허락 대기 트리는 `/professors` 목록에만 보이고 링크가 없다.
- 상태는 관리자만 바꾼다 (`admin_set_tree_open`, 함수 안에서 `is_admin()` 확인). 트리 주인 권한(`grant update`)으로는 바꿀 수 없다.
- **하트**: 로그인한 사용자만, 교수님 트리 하나에 1인 1개(`auth.uid()` 기준), 다시 누르면 취소. 허락 대기·열림 모두 누를 수 있다.
- 관심 수는 누구나 볼 수 있지만 **누가 눌렀는지는 공개하지 않는다** (본인이 눌렀는지만 `liked_by_me`로).
- 목록은 관심 수 내림차순(같으면 이름순). 검색은 이름·학과 부분 일치이며, 교수님 수가 적으므로 받은 목록을 화면에서 걸러도 된다.

### 4.7 내 트리 꾸미기 (`/me/style`)
- 트리 주인만 바꾼다 (일반 트리, RLS의 기존 주인 update 권한).
- **트리 색**(`trees.tree_color`)과 **배경 테마**(`trees.theme`)를 따로 고른다. 와이어프레임의 임시 값: 트리 색 초록·포스텍 레드·눈꽃·금색·분홍·남색, 배경 밤하늘·눈 오는 날·벽난로·포스텍 캠퍼스. 실제 id·색 값은 디자인 확정(D2) 후 `lib/constants.ts`에 넣는다.
- 칠판 테마(`chalkboard`)는 교수님 트리 전용이라 일반 트리 선택지에 없다. **DB에서 강제**한다: 주인은 `grant update`로 `trees.theme`를 직접 바꿀 수 있으므로, 서버 액션 검사만으로는 막을 수 없다. `0003`에 check 제약 `kind <> 'user' or theme <> 'chalkboard'`를 넣는다 (5.3).
- 저장하면 친구가 링크로 들어왔을 때 그 색과 테마로 보인다. 장식은 그대로다.

## 5. 인터페이스

### 5.1 화면
화면 구조·문구·상태는 [와이어프레임](https://claude.ai/artifact/48YKQPtn78agRoLiFXwSE5)을 따른다 (모바일 390px 기준). 화면별 데이터·액션은 2.3.

| URL | 설명 | 로그인 |
| --- | --- | --- |
| `/` | 홈: 카운트다운(일·시간·분·초), 트리 미리보기(데모 장식), 위쪽 버튼 분기(3장), 고백 카운터, 통계(트리/편지/오늘 달린 편지), "교수님께 마음 전하기" 카드(→ `/professors`), 이용 방법, 이스터에그 힌트 | - |
| `/login` | 카카오/구글 로그인, `?next=` 유지(같은 사이트 경로만, 아래), `?error=1`이면 오류 알림, 인앱 브라우저 안내 | - |
| `/create` | 트리가 없으면 새로 만들기, 있으면 이름 바꾸기 (같은 경로). 이름 최대 20자, 글자 수 표시, 트리 미리보기 | 필요 |
| `/me` | 내 트리(썸네일·이름·받은 편지 수·D-N), 트리 보러 가기, 링크 복사·공유, 색·테마 바꾸기, 이름 바꾸기, 관리자 링크(관리자만), 로그아웃. 트리가 없으면 "아직 트리가 없어요" + 내 트리 만들기 | 필요 |
| `/me/style` | 내 트리 꾸미기: 트리 색·배경 테마 선택, 미리보기, 저장 (4.7) | 필요 (주인) |
| `/professors` | 교수님께 마음 전하기: 관심순 목록, 검색, 하트, 트리 꾸미러 가기 (4.6) | - (하트는 필요) |
| `/t/[slug]` | 트리 보기 (주인/방문자 분기). 허락 대기 교수님 트리는 없는 트리로 처리 | - |
| `/t/[slug]/write` | 1/2 장식 고르기 → 2/2 편지 쓰기 → 트리로 복귀 (3장) | - |
| `/admin` | 탭 3개: 교수님 트리 만들기 / 교수님 목록(허락 상태) / 신고 N. 관리자가 아니면 "관리자만 볼 수 있어요" | 관리자 |

**공통 상태**: 없는 트리 "트리를 찾을 수 없어요"(+ 홈으로) · 그 밖의 404 "페이지를 찾을 수 없어요" · 권한 없음 · 일시적 오류(`app/error.tsx`: "잠시 문제가 생겼어요" + 다시 시도·홈으로, 조회 함수가 throw할 때 — 2.3 오류 계약) · 불러오는 중(`loading.tsx` — 로그인이 필요한 `/me`·`/create`·`/admin`에만. 링크로 공유되는 `/`·`/t/**`에 두면 응답이 스트리밍되어 카카오톡 미리보기 봇이 og 태그를 못 읽고 없는 트리가 404 대신 200이 된다) · 화면 아래 짧은 알림(예: "링크를 복사했어요", "트리 이름을 바꿨어요") · 폼 제출 중에는 버튼을 막고 "…하는 중" 표시 · 서버 액션의 `{ error }` 문구는 폼 위 알림에 그대로 보여 준다.

**트리 넘김 (C3, `/t/[slug]`)** — 장식은 한 트리에 18개. 넘으면 "다음 트리"로 넘겨 본다.
- 순서: 오래된 편지부터. 첫 화면은 1번째 트리, 편지를 막 달고 돌아오면(`?added=1`) 새 장식이 있는 마지막 트리 + pop-in.
- 넘기기: 트리 영역 좌우 스와이프(세로 스크롤은 막지 않음), ◀ ▶ 버튼, 트리 안에 포커스가 있을 때 ←/→ 키.
- 표시: `3 / 12` 숫자 + "처음"/"최신" 바로가기. 트리가 1개면 표시하지 않는다.
- 전환: 트리·전구·별은 그대로 두고 장식 묶음만 바뀐다. `prefers-reduced-motion`이면 애니메이션 없이 바로 바꾼다.
- 접근성: 넘김 버튼에 이름("이전 트리"/"다음 트리")을 붙이고, 넘길 때 "트리 N개 중 M번째 트리"를 화면 낭독기로 알린다.
- 스토리 이미지 저장은 지금 보고 있는 트리를 그대로 찍는다 (총 편지 수는 캡처 영역 안, 넘김 버튼은 밖).
- 장식이 줄어(신고 등) 트리 수가 줄면 마지막 트리로 맞춘다.
- 확인용: 데모 모드에서만 `?fill=60`으로 데모 장식을 복제해 채운다 (실서버에서는 무시). 스와이프 기준 거리·애니메이션 시간 같은 값은 `components/TreeView.tsx`·`app/globals.css`에 있다.

- **`next` 검사** (`/login`·`/auth/callback` 공통): `next`는 `/`로 시작하고 `//`·`/\`로 시작하지 않는 상대 경로만 받는다. 그 밖의 값(`https://…` 등)이나 값이 없으면 `/`로 보낸다. 검사 없이 넘기면 로그인 후 다른 사이트로 보내는 open redirect가 된다.

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
  - **추가 예정** (마이그레이션 `0003`): `is_open boolean not null default true` (교수님 트리는 `false`로 생성, 4.6) · `tree_color text` (null이면 테마 기본색, 4.7). 둘 다 select 권한·`TREE_COLUMNS`에 넣는다. 주인 `grant update`에는 `tree_color`를 **추가**한다 (기존 `theme`·이름 권한은 유지, `is_open`은 넣지 않음). 이미 있는 교수님 트리는 허락을 받지 않았으므로 `0003`에서 `update trees set is_open = false where kind = 'professor'`로 닫는다 (이미 달린 편지는 지우지 않고, 트리를 열면 다시 보인다) · check 제약 `trees_chalkboard_professor_only`: `kind <> 'user' or theme <> 'chalkboard'` (4.7). 적용 전에 일반 트리 중 `chalkboard`가 있으면 `classic`으로 바꾼다
- `professor_likes(tree_id, user_id, created_at)` — **추가 예정**. 기본키 `(tree_id, user_id)`, `kind = 'professor'` 트리만. 테이블 직접 조회·변경은 막고 RPC로만 접근
- `letters(id, tree_id, ornament_type, nickname, content, is_confession, ip_hash, client_hash, reported, hidden, created_at)` — `client_hash` **추가** (인덱스 `(client_hash, created_at)`)
- RPC: `get_ornaments(tree_id)`(본문·고백 여부 제외), `get_stats()`, `report_letter`, `claim_tree`, `admin_*`
- RPC **추가**: `submit_letter(tree_id, ornament_type, nickname, content, is_confession, ip_hash, client_hash)` — `security definer`, service role만 실행 가능 — 기존 관리자 함수처럼 반드시 `revoke execute ... from public, anon, authenticated` (안 하면 브라우저에서 직접 호출해 작성 제한을 건너뛸 수 있음) 후 `grant execute ... to service_role` (`public`에서 회수하면 service role도 실행 권한을 잃으므로 명시적으로 다시 줘야 함). 트리 존재 확인·작성 제한 확인·INSERT를 한 트랜잭션에서 처리하고, 제한 초과 시 오류 코드를 돌려줌 (API가 `429`로 변환). `is_open = false`인 트리는 트리 없음과 같이 거부 (`0003`에서 반영)
- RPC **추가 예정** (`0003`, 4.6):
  - `list_professors()` → `id, slug, owner_name, department, is_open, like_count, liked_by_me` (anon도 실행 가능, `liked_by_me`는 `auth.uid()`가 없으면 `false`, 누른 사람 목록은 돌려주지 않음)
  - `toggle_professor_like(p_tree_id)` → `liked, like_count` (authenticated만, `auth.uid()` 기준 1인 1개)
  - `admin_set_tree_open(p_tree_id, p_open)` (관리자만), `admin_list_special_trees`의 반환에 `department, is_open, like_count` 추가
  - `security definer`면 `revoke execute ... from public, anon, authenticated` 후 필요한 역할에만 `grant`

## 6. 미정 / 범위 밖
- 포닉스: 학교 공식 캐릭터 이미지를 쓰려면 사용 허락 필요. 현재는 직접 그린 오리지널 불새.
- 도메인: 구매를 권장 (`*.vercel.app`은 신뢰도가 낮아 보이고, 카카오 공유 SDK 도메인 등록에도 고정 주소가 편함). 이름과 구매자 결정 필요
- 학교망 IP 구조: 작성 제한 숫자(4.4)는 베타에서 확인 후 확정
- 12/25 플랜 증설: 부하 테스트(S18) 결과로 Supabase·Vercel을 공개 기간에만 유료로 올릴지, 비용은 누가 낼지 (4.5)
- 필요해지면 추가 (1.1): Turnstile 봇 방어, 트리별 OG·서버 생성 스토리 이미지, Supabase CLI, Playwright E2E
- 크리스마스 이후 서비스 종료/보관 정책
- **교수님께 편지를 전하는 방법**: 초대 코드 화면을 뺐으므로 교수님 트리의 주인은 만든 관리자 계정이다. 공개 후 관리자가 편지를 확인해 전달할지(인쇄·이미지 등), 초대 코드(`claim_tree`, DB에 남아 있음)를 다시 화면에 넣을지 결정 필요
- **트리 색·배경 테마 값**: 와이어프레임의 배경 4종(밤하늘·눈 오는 날·벽난로·포스텍 캠퍼스)과 기존 `THEMES`(classic·snow·pink·night·postech·chalkboard)를 어떻게 맞출지 D2에서 결정. 이미 저장된 `theme` id는 지우지 않는다
- **이메일 OTP 로그인**: 와이어프레임 로그인 화면에는 없음. 지금처럼 `NEXT_PUBLIC_ENABLE_EMAIL_LOGIN` 테스트용으로만 둔다
- **데모 트리 구경하기**: 홈 버튼이 `/t/demo`(데모 모드) 대신 실서버에서 무엇을 보여 줄지 (예: 운영진 트리 slug 고정)
- 범위 밖: 모바일 네이티브 앱, 실시간 알림, 편지 답장

## 7. 작업 관리 (타임라인 · plan.md)
- **기준은 타임라인**: 📅 [포스텍 트리 개발 타임라인](https://claude.ai/artifact/LVz71ybViGJ7xw6Ga1mD1Y). 사람은 타임라인을 보고 일한다. 작업 추가·일정·선행 작업·완료 기준·완료 체크는 타임라인에서 바꾼다.
- **작업 번호**: 레인 문자 + 숫자. `D` 디자인 · `F` 프론트엔드 · `S` 서버 · `C` 클라이언트 · `T` 공통 (예: `S11`). 한 번 쓴 번호는 바꾸거나 다시 쓰지 않는다 (지운 작업의 번호 포함).
- **plan.md는 타임라인의 사본**: `<!-- timeline:start -->`와 `<!-- timeline:end -->` 사이의 작업 목록은 타임라인에서 생성하며 손으로 고치지 않는다. 둘이 다르면 **타임라인이 맞다**.
- **동기화**: 타임라인을 바꾸면 `node scripts/sync-plan.mjs <타임라인 HTML 또는 state JSON>`으로 plan.md를 다시 만들어 커밋한다. 스크립트는 타임라인 페이지의 `<script id="state">` JSON을 읽어 마커 사이만 교체한다.
- **타임라인에 아직 없는 작업**: 타임라인을 고칠 수 없는 사람·세션이 찾은 작업은 plan.md의 "타임라인에 아직 없는 작업"에 적고, 타임라인 편집 권한이 있는 사람이 옮긴다.
- **Claude에게 맡기기**: "S11 해줘"처럼 작업 번호로 요청한다. Claude가 따르는 절차는 `CLAUDE.md`의 "작업 번호로 요청받았을 때"에 있다.
- **한 내용은 한 곳에만**: 결정·규칙·계약·환경변수는 이 문서, 꼭 지킬 제약·작업 절차·명령어·검증은 `CLAUDE.md`, 코드를 어떻게 짜는지(버전·파일 역할·데이터 접근 패턴·인증·데모 모드·스타일)는 plan.md의 "기술 스택 · 작업 가이드"에 적는다. 다른 문서의 내용은 다시 쓰지 않고 절 이름으로 가리킨다.
- **plan.md의 "기술 스택 · 작업 가이드"**: 타임라인 마커 **밖**에 있어 동기화로 지워지지 않는다. 스택·계약이 바뀌어 그 절의 코드 설명이 틀리게 되면 이 문서를 먼저 고치고 같은 커밋에서 그 절도 맞춘다.
- **완료 표시**: 완료 기준을 만족하면 타임라인에서 완료 체크(기준)하고, plan.md는 다음 동기화 때 맞춰진다. Claude가 작업을 끝낸 경우 같은 커밋에서 plan.md도 `[x]`로 바꾼다.
