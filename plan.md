# 포스텍 트리 — 구현 계획

> 마지막 갱신: 2026-11-14 (프론트엔드·서버 역할 분리, 스펙 2장) · 📅 [타임라인 (간트 차트)](https://claude.ai/artifact/XZPtaxuvxWC3hkFvo1VyNi) · 스펙은 [`spec.md`](./spec.md). 끝낸 항목은 `[x]`로 바꾸고, 새 작업은 해당 역할 아래에 추가합니다.
> 표기: 🎨 디자인 · 🖥 프론트엔드 · 🛠 서버 · 📱 클라이언트

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

---

## 🎨 디자인
### M1 (~11/19)
- [ ] **11/13 에셋 전달 규칙 합의** — 아이콘 파일 이름 = 장식 ID (`public/ornaments/ball-red.svg`), 포닉스 `public/ponix.svg`, 색·폰트는 토큰 이름. 그래야 클라이언트가 코드에 바로 끼울 수 있음
- [ ] 컬러 팔레트·폰트 확정 (현재: 남색 배경 + 포스텍 레드, Jua / Gowun Dodum)
- [ ] 로고 / 타이틀 "포스텍 트리"
- [ ] 트리 일러스트 + D-day 단계 시안 (불 꺼짐 / 중간 / D-3 / 크리스마스)
- [ ] 장식 아이콘 SVG 세트 — 현재 이모지 대체 (기본 10, POSTECH 10, 학과 16, 교수님 4). `lib/constants.ts`의 id 목록 기준
- [ ] 편지지 + 봉투 열림 디자인
### M2 (~11/26)
- [ ] 포닉스 캐릭터 (오리지널 또는 공식 허락 후 사용) — 탭 반응 포즈 포함
- [ ] 교수님 트리 칠판 테마
- [ ] OG 썸네일 1200×630 (카톡·인스타 링크 미리보기) — 모든 트리가 같은 이미지 1장을 씀
- [ ] 인스타 스토리 공유 이미지 (1080×1920 비율) — 화면의 트리 영역을 그대로 캡처하므로, **트리 화면의 캡처 영역(제목·트리·안내 문구) 레이아웃**으로 디자인
- [ ] 홈 / 로그인 / 내 페이지 화면 디자인
### 전달 방식
- [ ] 에셋은 `public/ornaments/<id>.svg`, `public/ponix.svg` 처럼 **장식 id와 같은 파일명**으로 전달
- [ ] 색·폰트는 토큰 이름으로 전달 (`--color-berry` 등, `app/globals.css` `@theme`)

## 🖥 프론트엔드 · 와장창프론트엔드
### M1 (~11/19)
- [ ] 🛠 서버와 경계 합의: 화면별로 필요한 `app/actions.ts` 서버 액션·`lib/data.ts` 조회 함수 목록을 스펙 2.2-5에 정리
- [ ] 🛠 서버가 준 `.env.local`로 실서버 연결 → 로그인 → 트리 생성 → 내 페이지 화면 흐름 확인 (오류 문구·로딩 상태 포함)
- [ ] `framer-motion` 의존성 제거
### M2 (~11/26)
- [ ] 홈 / 로그인 / 트리 생성 / 내 페이지 / 관리자 페이지에 🎨 디자인 반영
- [ ] 폰트를 `next/font/google`로 교체 (`app/layout.tsx`)
- [ ] 정적 OG 이미지 적용 (`app/opengraph-image.png`, 🎨 시안) → 카톡·인스타 링크 미리보기 확인
- [ ] 페이지 메타데이터 정리 (`app/layout.tsx`, `app/t/[slug]/page.tsx`의 `generateMetadata`)
### M3~
- [ ] 베타 피드백 중 페이지·폼 버그 수정
- [ ] 접근성: 폼 라벨·에러 문구·키보드 이동 (홈·로그인·내 페이지·관리자)

## 🛠 서버 · (별명 미정)
### M1 (~11/19)
- [ ] Supabase 프로젝트 생성, SQL Editor로 `supabase/migrations/0001_init.sql` 적용
- [ ] 마이그레이션 `0002_submit_letter.sql` 작성·적용: `letters.client_hash` 컬럼·인덱스, `submit_letter()` 함수 + **`revoke execute ... from public, anon, authenticated`** + `grant execute ... to service_role` — 스펙 5.3
- [ ] `scripts/test-rls.sql`에 `service_role` 역할 생성, `\i supabase/migrations/0002_submit_letter.sql`과 테스트 추가 (anon·authenticated는 `submit_letter()` 호출 실패, service_role은 성공, 제한 초과 시 거부) → 빈 Postgres DB에서 실행 (스크립트가 `auth` 스키마를 지우므로 **Supabase DB에서 실행 금지**)
- [ ] `/api/letters` 수정: `anon_id` 쿠키 발급, `client_hash` 계산, 기존 개수 조회 + INSERT를 `submit_letter()` 1회 호출로 교체. 요청·응답 형식은 그대로 — 스펙 4.4, 5.2
- [ ] 카카오 개발자 앱 + 구글 OAuth 등록, Supabase Provider 설정 (카카오 "Allow users without an email")
- [ ] `.env.local` 구성 → 로컬에서 실제 로그인 → 트리 생성 → 편지 작성까지 확인, 🖥 프론트엔드·📱 클라이언트에 환경변수 전달 (비밀 키 제외)
- [ ] GitHub Actions: lint · typecheck · build + Postgres 서비스 컨테이너에서 `test-rls.sql` (실패하면 머지 금지)
### M2 (~11/26)
- [ ] 도메인 결정·구매 → Vercel 연결
- [ ] Vercel 배포, 환경변수 (스펙 1.1 표), PR Preview 배포 확인
- [ ] Supabase Redirect URL에 배포 주소 추가
- [ ] Vercel Analytics 켜기 · (선택) Sentry 연동
- [ ] (선택, 📱 카카오 공유를 할 경우) Kakao Developers에 사이트 도메인 등록, JS 키 발급
- [ ] 관리자 계정 지정, 교수님 트리 생성 → 초대 코드 전달
### M3~
- [ ] 학교망·기숙사 와이파이에서 IP 공유 여부 확인 → 작성 제한 숫자 확정 (스펙 4.4)
- [ ] 베타 피드백 반영 (금칙어 보강, rate limit 조정). 도배가 생기면 Turnstile 추가 검토
- [ ] 12/24 공개 리허설 (`update app_config set reveal_at = now()` → 확인 → 원복)
- [ ] Supabase 백업 / 사용량 모니터링 (무료 플랜은 약 1주일 미사용 시 일시정지 — 개발 공백 후에는 대시보드에서 상태 확인)

## 📱 클라이언트 · 람쥐썬더
### M1 (~11/19)
- [ ] 인앱 브라우저 QA — 인스타·카카오톡에서 링크 열기, 공유 버튼, 이미지 저장, 키보드가 입력창 가리는지
- [ ] 인앱 브라우저에서 `navigator.share({ files })` 지원 여부 확인 (인스타·카카오톡, iOS·Android) → 저장 방식 확정
- [ ] iOS Safari / Android Chrome QA, 저사양 폰 애니메이션 성능(전구·눈·장식 흔들림)
- [ ] 장식이 많을 때(19개 이상) 페이지 넘김 UX 개선
### M2 (~11/26)
- [ ] 디자인 에셋 반영: 장식 이모지 → SVG (`findOrnament`가 이미지 경로를 쓰도록), 트리 일러스트, 편지지/봉투
- [ ] 포닉스 SVG 교체
- [ ] `ShareButtons` 저장 방식 개선: `html-to-image` 캡처는 유지, `<a download>` 대신 `navigator.share({ files })` → 안 되면 이미지를 띄워 "길게 눌러 저장" 안내
- [ ] 스토리 캡처 영역을 🎨 디자인대로 다듬기 (`TreeView`의 `captureRef` 영역)
- [ ] (선택) 카카오톡 공유 버튼: Kakao JS SDK (`lib/kakao.ts`)
- [ ] 12/25 편지 열기 연출 다듬기 (봉투 → 편지 전환, 여러 통 연속 읽기)
### M3~
- [ ] 접근성: 버튼 포커스, aria-label, 애니메이션 줄이기(`prefers-reduced-motion`)
- [ ] 베타 버그 수정

## 공통
- [ ] 서버 담당자 별명 정하기 (스펙 2장, 타임라인 담당자 칸)
- [x] 기술 스택 확정 (11/14) — 기존 코드 유지 + 위험 3가지 수정, 보류 항목은 스펙 1.1·6장
- [ ] 버그·요청은 GitHub Issues에 등록, 라벨 `design` / `frontend` / `server` / `client`
- [ ] 작업은 PR로 올리고 Vercel Preview 링크를 폰으로 확인한 뒤 머지 (CI 통과 필수)
- [ ] 베타 테스터 모집 (11/29)
- [ ] 오픈 공지 인스타 게시물·스토리 (🎨 이미지, 문구는 함께)
