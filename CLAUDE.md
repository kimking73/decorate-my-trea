# 작업 규칙 (포스텍 트리)

## 문서 우선
모든 작업은 이 순서로 진행한다.
1. **`spec.md` 갱신** — 무엇을 왜 바꾸는지, 바뀌는 규칙·화면·계약을 먼저 적는다. 상단 "마지막 갱신" 날짜도 고친다.
2. **`plan.md` 갱신** — 구현 단계를 해당 역할(🎨 디자인 / 🖥 프론트엔드 / 🛠 서버 / 📱 클라이언트) 아래 체크리스트로 추가한다.
3. 구현
4. 끝난 항목을 `[x]`로 체크하고 커밋에 함께 포함한다.

## 역할과 소유 파일
- 소유 파일 맵과 팀 간 계약은 `spec.md` 2장에 있다. 다른 역할의 파일을 고칠 땐 그 사람에게 리뷰를 받는다.
- 계약(데이터 타입, `TreeScene`/`TreeView` props, `POST /api/letters`, 장식 id, 서버 액션·조회 함수)을 바꾸려면 `spec.md`부터 수정한다.
- 프론트엔드는 `app/actions.ts`·`lib/data.ts`를 호출만 하고, 쿼리·권한·API 구현은 서버 담당이 맡는다.
- `lib/constants.ts`의 장식 `id`는 DB에 저장되므로 이미 쓰인 id는 바꾸거나 지우지 않는다.

## 지켜야 할 제약
- 편지 본문 공개 시점은 DB RLS가 강제한다. 클라이언트 시간으로 열람을 판단하는 코드를 추가하지 않는다.
- 고백 여부(`is_confession`)는 공개 전 어떤 응답에도 내보내지 않는다 (홈 집계 숫자만 허용).
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 코드(`app/api/**`, server-only)에서만 쓴다.

## 명령어
- `npm run dev` — 로컬 실행 (Supabase 환경변수가 없으면 데모 모드: `/t/demo`, `/t/prof-demo`)
- `npm run build`, `npm run lint` — 커밋 전 통과 확인
- RLS 테스트: 빈 로컬 Postgres DB에서 `psql -d <빈DB> -f scripts/test-rls.sql`
- D-day 연출 미리보기 (개발/데모 모드): `/t/demo?dday=7`, `/?dday=0`
