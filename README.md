# 🎄 포스텍 트리

POSTECH 학생들이 서로의 크리스마스 트리에 **익명 편지**를 장식으로 달아주고, **12월 25일 0시(KST)**에 편지가 열리는 웹페이지입니다.

- 트리 주인: 카카오/구글 로그인 → 이름만 입력하면 트리 생성 → 링크를 인스타 스토리에 공유
- 친구: **로그인 없이** 링크로 들어와 장식 선택 + 익명 편지 작성
- 크리스마스 전: 장식(닉네임)만 보이고 본문은 잠김 · 크리스마스 이후: **주인만** 열람

Supabase 환경변수가 없으면 **데모 모드**로 실행되어 `/t/demo`, `/t/prof-demo` 에서 화면을 미리 볼 수 있습니다.

## 기능

| 기능 | 설명 |
| --- | --- |
| 공개 시점 강제 | 편지 본문은 DB RLS 로 `트리 주인 AND now() >= reveal_at` 일 때만 조회 가능. 클라이언트 시간 조작으로 열 수 없음 |
| 익명 작성 | 서버 라우트(`/api/letters`)가 service role 로 저장. IP 는 솔트 해시만 저장, 분당 5개·트리당 하루 10개 제한, 금칙어 필터 |
| 💘 고백 카운터 | 편지 쓰는 친구가 "이 편지는 고백이에요" 체크 → **홈 화면**에만 "지금까지 총 N명이 고백하였습니다" 집계. 트리에서는 일반 장식과 똑같이 보여 주인도 모름. 크리스마스에 편지를 열 때만 💘 표시 |
| 💡 D-day 연출 | 12/1부터 전구가 하루 1개씩 켜짐(24개), 눈이 점점 쌓임(층 테두리·꼭대기·바닥), D-7부터 별이 빛남, D-3부터 선물 상자 등장, 크리스마스엔 전구 무지개 순환 |
| 👨‍🏫 교수님 트리 | 관리자가 `/admin` 에서 생성(칠판 테마, 교수님 전용 장식). 초대 코드를 교수님께 드리면 `/me` 에서 입력해 주인이 됨 |
| 🦁 POSTECH 장식 | 지곡회관 학식, 77계단, A+, 밤샘 커피, 과메기, 영일대 바다, 학과별 장식 등 |
| 🥚 이스터에그 | 꼭대기 별: 탭마다 반짝, 7연타 → 전구 전부 켜지며 체이스 + 산타 썰매 / 트리 옆 포닉스 탭 → 포스텍 레드 트리 / 편지 키워드: `종강` 폭죽, `과제` 장식이 울음, `학점` 별이 A+, `좋아해·사랑해` 하트 |
| 📊 통계 | D-day 카운트다운, 트리/편지/오늘 편지 수 |
| 📸 공유 | Web Share / 링크 복사, 스토리용 트리 이미지 저장 |
| 🚨 신고 | 주인이 편지 숨기기·신고 → 관리자가 복구/삭제 |

## 스택
Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Auth, Postgres, RLS) · Vercel

## 설정 방법

### 1. Supabase
1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. SQL Editor 에 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 실행
3. **Authentication → Providers**
   - **Google**: Google Cloud Console 에서 OAuth 클라이언트 생성, 승인된 리디렉션 URI 에 `https://<project>.supabase.co/auth/v1/callback` 추가 후 Client ID/Secret 입력
   - **Kakao**: [Kakao Developers](https://developers.kakao.com) 앱 생성 → 카카오 로그인 활성화, Redirect URI 에 위 콜백 URL 추가 → REST API 키 / Client Secret 입력. 비즈 앱이 아니면 이메일 동의항목을 받을 수 없으므로 Supabase Kakao 설정에서 **"Allow users without an email"** 을 켜세요
4. **Authentication → URL Configuration**: Site URL 을 배포 주소로, Redirect URLs 에 `https://<배포주소>/auth/callback` 추가
5. 관리자 지정: 로그인 후 SQL Editor 에서
   ```sql
   update profiles set is_admin = true where id = (select id from auth.users where email = 'me@example.com');
   ```

### 2. 환경변수 (`.env.local`, Vercel 에도 동일하게)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # 서버 전용, 절대 공개 금지
IP_HASH_SALT=<랜덤 문자열>
NEXT_PUBLIC_SITE_URL=https://<배포주소>
# NEXT_PUBLIC_ENABLE_EMAIL_LOGIN=true  # 테스트용 이메일 매직링크 로그인
```

### 3. 실행 / 배포
```bash
npm install
npm run dev
```
GitHub 에 올린 뒤 Vercel 에서 Import → 환경변수 입력 → Deploy.

## 테스트 / 운영 팁
- **공개 시각 테스트**: `update app_config set reveal_at = now();` 로 즉시 공개, 테스트 후 `'2026-12-25 00:00:00+09'` 로 복구. (화면 카운트다운은 DB 값을 따릅니다)
- **RLS 검증**: 로컬 Postgres 빈 DB 에서 `psql -d treetest -f scripts/test-rls.sql` — 공개 전 본문 0건, 다른 유저/비로그인 열람 불가, 권한 상승 차단을 확인합니다
- **D-day 연출 미리보기**: 개발/데모 모드에서 `/?dday=7`, `/t/<slug>?dday=0` 처럼 남은 일수를 지정 (편지 열람 권한과 무관, 프로덕션에선 무시됨)
- 금칙어는 `lib/moderation.ts`, 장식/학과/키워드 이스터에그는 `lib/constants.ts`, 전구/눈 진행 규칙은 `lib/season.ts` 에서 수정

## 구조
```
app/
  page.tsx               홈 (카운트다운, 고백 카운터, 통계, 교수님 트리)
  t/[slug]/page.tsx      트리 보기 (주인/방문자 분기)
  t/[slug]/write/        장식 선택 + 편지 작성
  create/ me/ admin/ login/
  api/letters/route.ts   익명 편지 저장 (검증·rate limit)
  actions.ts             트리 생성/수정, 초대코드, 관리자 액션
components/              TreeScene, TreeView, WriteForm, LetterModal, Snow, Countdown ...
lib/                     constants, data(조회 + 데모 데이터), supabase 클라이언트
supabase/migrations/     스키마 + RLS + RPC
```
