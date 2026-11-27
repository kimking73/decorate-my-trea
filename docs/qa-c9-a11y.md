# C9 접근성 점검 (2026-11-26)

규칙은 [`spec.md`](../spec.md) 4.2 "접근성"·"애니메이션 성능 규칙"에 있다. 이 문서는 점검 방법·결과와 사람이 할 확인을 담는다.

## 다시 돌리는 법
```bash
# 1) axe-core 를 저장소 밖 빈 폴더에 받는다 (저장소 의존성으로 넣지 않는다)
mkdir -p /tmp/axe && (cd /tmp/axe && npm init -y >/dev/null && npm i axe-core)
# 2) 데모 서버 (Supabase 환경변수 없이)
npm run dev
# 3) 점검 (--out 을 주면 375px 스크린샷 저장)
node scripts/a11y-check.mjs --axe /tmp/axe/node_modules/axe-core/axe.min.js --base http://localhost:3000 --out /tmp/a11y-shots
```
실패가 있으면 종료 코드 1. `meta-viewport` 는 프론트엔드 파일(`app/layout.tsx`)에서 나서 목록에만 보이고 실패로 세지 않는다 (`--ignore ""` 로 끄면 실패로 센다).

데모 트리 id(`demo`)가 UUID 가 아니어서 `/api/letters` 가 데모 분기 전에 404 를 준다 (서버 담당 보고). 그래서 편지 쓰기 흐름에서는 이 요청만 성공 응답으로 바꿔 클라이언트 동작을 본다.

## 결과 (375px, Chromium, axe-core 4.10)
같은 스크립트를 `main`(C9 전)과 `task/C9-a11y`(C9 후)에서 돌렸다.

| 항목 | 전 | 후 |
| --- | --- | --- |
| axe critical·serious (클라이언트 컴포넌트) | 편지 창 `aria-dialog-name` 1건 | 0건 |
| axe `meta-viewport` (`app/layout.tsx`, 프론트엔드) | 모든 화면 1건 | 그대로 (보고) |
| 키보드·동작 줄이기 점검 37개 | 18개 실패 | 모두 통과 |

전에 실패했던 것:
- 장식 이름에 잠김 안내가 없음, 잠긴 장식을 눌렀을 때 안내를 스크린 리더가 읽지 않음
- 별·포닉스를 Enter 로 누르면 버튼이 다시 만들어져 **키보드 포커스가 사라짐** (`key` 가 버튼에 있었음), 7연타 안내를 읽지 않음
- 트리 넘김 버튼 30~32px, 별 40px (44px 미만)
- 편지 쓰기 장식 탭이 ←/→ 로 움직이지 않음, 입력창 `outline-none` 으로 포커스가 안 보임
- 편지 창: 이름 없음, 열어도 포커스가 창 밖, Tab 이 창 밖으로 나감, 닫으면 포커스가 페이지 맨 위로
- 동작 줄이기에서도 썰매가 지나가고 체이스 전구가 계속 깜빡임

## 바꾼 것 (클라이언트 파일)
- `app/globals.css`: 공통 `:focus-visible` 링(안쪽 남색 2px + 바깥 노랑 3px). 동작 줄이기에서 체이스·흔들림·포닉스 점프·`pop-in` 멈춤, 썰매·하트 숨김, 별은 빛만.
- `LetterModal.tsx`: 이름("닉네임의 편지"), 열면 창 → 펼쳐지면 "닫기"로 포커스, Tab 가두기, 닫으면 연 장식으로 복귀, 버튼 `type`·44px, 흐린 글자 대비.
- `TreeScene.tsx`: 장식 이름에 ", 12월 25일에 열려요", 이모지·닉네임 `aria-hidden`, 닉네임 라벨 `bg-black/60`, 별·포닉스 이름에 동작 설명·`aria-pressed`, `key` 를 안쪽으로, 44px, 토스트 알림 영역.
- `TreeView.tsx`: 트리 넘김 버튼 44px, 안내 문구 알림 영역 (C12 PR 과 겹치지 않는 줄만).
- `WriteForm.tsx`: 장식 탭 ←/→/Home/End·roving tabindex, 입력창 포커스 링, 동작 줄이기면 폭죽·하트 끔, 이스터에그 문구 알림 영역.
- `Countdown.tsx`: 매초 바뀌는 숫자 상자는 숨기고 한 문장으로. `ShareButtons.tsx`: 이모지 숨김, 결과 문구 알림 영역.

## 사람이 할 확인 (실기기)
- [ ] iOS VoiceOver (Safari·인스타 인앱): `/t/demo` 장식을 쓸어 넘길 때 "닉네임의 장식 이름 장식, 12월 25일에 열려요"로 읽는지, 두 번 탭하면 안내를 읽는지
- [ ] Android TalkBack (Chrome·카톡 인앱): 같은 흐름 + 편지 쓰기 2단계 끝까지
- [ ] `?owner=1&dday=0` 편지 창: 열면 편지 내용으로 이동, 닫으면 장식으로 돌아오는지
- [ ] 폰 설정 "동작 줄이기"(iOS)·"애니메이션 삭제"(Android)를 켜고: 눈·전구가 멈추고, 별 7연타에 썰매가 안 지나가고, 편지를 달 때 폭죽·하트가 없는지
- [ ] 블루투스 키보드(또는 PC 브라우저)로 Tab 이동 시 노란 포커스 링이 모든 버튼에서 보이는지
