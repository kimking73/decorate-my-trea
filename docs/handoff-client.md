# 클라이언트 인수인계

> 작성: 2026-11-27 · 이전 담당: 람쥐썬더 · 기준: `main` (a3e5156, F7 #21까지)
> 일정·완료 여부의 기준은 [타임라인](https://claude.ai/artifact/LVz71ybViGJ7xw6Ga1mD1Y)이고, 이 문서는 넘기는 시점의 상황 정리입니다. 규칙은 [`CLAUDE.md`](../CLAUDE.md), 스펙은 [`spec.md`](../spec.md), 작업 목록은 [`plan.md`](../plan.md).

## 1. 완료한 것
| 작업 | PR | 비고 |
| --- | --- | --- |
| C1 인앱 브라우저 QA | — | 데모 주인 미리보기 `?owner=1` ([#6](https://github.com/kimking73/decorate-my-trea/pull/6))로 진행 |
| C2 실기기·성능 QA | [#7](https://github.com/kimking73/decorate-my-trea/pull/7), [#8](https://github.com/kimking73/decorate-my-trea/pull/8) | 체크리스트 `docs/qa-c2-device.md`, 측정 `scripts/perf-measure.mjs`. 저사양 폰은 베타(T3)로 넘김 |
| C3 장식 많을 때 페이지 넘김 | [#2](https://github.com/kimking73/decorate-my-trea/pull/2) | 규칙 spec.md 5.1 "트리 넘김" |
| C13 편지 쓰기 2단계 화면·`treeColor` | [#14](https://github.com/kimking73/decorate-my-trea/pull/14) | |
| C12 공개 순간 요청 흩기·자동 재시도 | [#5](https://github.com/kimking73/decorate-my-trea/pull/5), [#18](https://github.com/kimking73/decorate-my-trea/pull/18), [#19](https://github.com/kimking73/decorate-my-trea/pull/19) | 검증 `scripts/reveal-check.mjs`, 규칙 spec.md 4.5 |
| T9 교수님 열람 화면 (`TreeView` `reader`) | [#15](https://github.com/kimking73/decorate-my-trea/pull/15) | 타임라인 번호 없음 (plan.md "타임라인에 아직 없는 작업") |
| 토스트 버그 수정 | [#16](https://github.com/kimking73/decorate-my-trea/pull/16) | 파일은 프론트엔드 소유 |
| C9 접근성 | [#25](https://github.com/kimking73/decorate-my-trea/pull/25) (리뷰 대기) | 포커스 표시, 편지 창 포커스 가두기·Esc, 움직임 줄이기. axe 위반 1→0 |
| 데모 "트리에 달기" 404 수정 | [#22](https://github.com/kimking73/decorate-my-trea/pull/22) (열림) | 머지 여부 확인 필요 |

## 2. 남은 작업
| 작업 | 타임라인 일정 | 막힌 이유 / 메모 |
| --- | --- | --- |
| C4 장식 아이콘 SVG 반영 | 11/21–11/24 | 디자인 D4 대기. 파일 이름 = 장식 ID (`public/ornaments/<id>.svg`, D1 합의). `findOrnament`가 이미지 경로를 쓰게 하고 이모지는 대체용으로 남기기 |
| C5 트리 일러스트·편지지 반영 | 11/20–11/24 | 디자인 D3·D5 대기 |
| C6 포닉스 교체 | 11/23–11/24 | 디자인 D6 대기 (`public/ponix.svg`) |
| C8 편지 열기 연출 | 11/26–11/28 | C5 대기 |
| C7 스토리 이미지 저장 방식 | 11/25–11/26 | 캡처 영역 디자인은 D9 대기. **저장 방식은 지금 가능**: `html-to-image` 캡처 → `navigator.share({ files })` → 안 되면 이미지를 띄워 "길게 눌러 저장" (인앱 브라우저는 `<a download>`가 막힘) |
| C11 (선택) 카카오톡 공유 | 11/25–11/26 | 실서버 배포·도메인(S4) 대기. `lib/kakao.ts` |
| C10 베타 버그 수정 | 11/29–11/30 | 베타(T3) 대기 |
| 저사양 폰 애니메이션 확인 | T3 때 | C2에서 넘김 |
| C3 트리 넘김 실기기 QA | C1·C2 후속 | plan.md "타임라인에 아직 없는 작업"에 항목 8개 |

가장 큰 병목은 디자인 시안입니다. 시안이 오는 대로 C4 → C5·C6 → C8 순서로 진행하면 됩니다.

## 3. 일하는 방식
- **Claude에게 맡기기**: "C7 해줘"처럼 작업 번호로 요청하면 `CLAUDE.md`의 "작업 번호로 요청받았을 때" 절차(선행 확인 → `task/<번호>-…` 브랜치 → build·lint·typecheck → plan.md 체크)대로 진행합니다. 푸시·PR은 요청할 때만 합니다.
- **소유 파일 (spec.md 2.1)**: `components/TreeScene.tsx`, `TreeView.tsx`, `useRevealRefresh.ts`, `WriteForm.tsx`, `LetterModal.tsx`, `Snow.tsx`, `Countdown.tsx`, `ShareButtons.tsx`, `lib/season.ts`, `app/globals.css`(애니메이션), `scripts/perf-measure.mjs`, `scripts/reveal-check.mjs`, `docs/qa-c2-device.md`, (선택) `lib/kakao.ts`. 다른 역할 파일을 고치면 그 담당자 리뷰를 받습니다.
- **팀 간 계약 (spec.md 2.2, 바꾸려면 spec.md부터)**: `TreeScene`·`TreeView` props(`treeColor`, `ownerMenu`, `reader` 포함), `WriteForm` props, `POST /api/letters` 형식, 장식 ID(추가만, 변경·삭제 금지).
- **제약 (CLAUDE.md)**: 편지 공개 시점은 DB RLS가 판단(클라이언트 시간으로 열람 판단 금지), 고백 여부는 공개 전 응답에 넣지 않기, 애니메이션은 spec.md 4.2 성능 규칙.
- **데모로 확인하기** (https://decorate-my-trea-demo.vercel.app, 또는 환경변수 없이 `npm run dev`)
  - `?dday=N` D-day 연출 · `?owner=1` 주인 화면 (`&dday=0`이면 데모 편지 열림) · `?fill=60` 장식 많을 때
  - `/t/prof-demo?key=demo` 교수님 열람 화면 · 데모 로그인은 spec.md 4.2
  - 공개 순간: `NEXT_PUBLIC_REVEAL_AT`을 몇 분 뒤로 두고 `node scripts/reveal-check.mjs` (오류 흉내 `DEMO_REVEAL_FAILURES`, spec.md 4.5)
  - 화면을 바꾸면 `/`, `/t/demo`, `/t/prof-demo`, `/t/demo?dday=7`, `/?dday=0`을 375px로 확인

## 4. 다른 팀원에게 걸려 있는 것
- 🛠 서버(민준): `getLetters`에서 DB 오류가 숨겨지는 문제를 S18(12/25 0시 부하 테스트) 전에 수정 ([#18](https://github.com/kimking73/decorate-my-trea/pull/18) 본문에 재현 방법), S4 실서버 배포.
- 🎨 디자인(n0ttin): D3·D4·D5·D6·D9 — 클라이언트 C4·C5·C6·C7·C8이 기다림.
- 📅 타임라인 관리자: plan.md "타임라인에 아직 없는 작업" 정리 (T9 열람 화면, C3 실기기 QA, 저사양 폰 확인), C9 완료 체크.
