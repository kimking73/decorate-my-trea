# 포스텍 트리 — 제품 스펙

> 마지막 갱신: 2026-11-12 · 작업을 시작하기 전에 이 문서를 먼저 고치고, 구현 단계는 [`plan.md`](./plan.md)에 체크리스트로 남깁니다.

## 1. 개요
- **목표**: POSTECH 학생들이 인스타그램에 자기 트리 링크를 올리고, 친구들이 **익명 편지**를 장식으로 달아주는 연말 이벤트. 편지는 **12/25 00:00 KST**에 열린다.
- **오픈**: 12/1 (트리 전구가 12/1부터 켜지기 시작)
- **참고 서비스**: colormytree.me
- **스택**: Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 · Supabase (Auth, Postgres, RLS) · Vercel

## 2. 팀과 역할

| 역할 | 담당 | 한 줄 정의 |
| --- | --- | --- |
| 디자인 | 팀원 A | 비주얼 아이덴티티, 일러스트, 아이콘, 공유 이미지 |
| 프론트엔드 & 서버 | 팀원 B | 페이지 구성·라우팅·로그인·데이터·API·DB·배포 |
| 클라이언트 | 본인 | 트리 화면의 렌더링과 인터랙션 (애니메이션, D-day 연출, 이스터에그, 편지 작성·열람 UI, 공유) |

### 2.1 소유 파일 맵
누가 고쳐도 되지만, **소유자가 리뷰**한다.

| 영역 | 소유 | 파일 |
| --- | --- | --- |
| 트리 화면 / 인터랙션 | 클라이언트 | `components/TreeScene.tsx`, `TreeView.tsx`, `WriteForm.tsx`, `LetterModal.tsx`, `Snow.tsx`, `Countdown.tsx`, `ShareButtons.tsx`, `lib/season.ts`, `app/globals.css` (애니메이션 부분) |
| 페이지 / 폼 | 프론트&서버 | `app/**/page.tsx`, `app/layout.tsx`, `app/not-found.tsx`, `components/TreeForm.tsx`, `LoginButtons.tsx`, `ClaimForm.tsx`, `AdminCreateForm.tsx` |
| 데이터 / 서버 | 프론트&서버 | `app/actions.ts`, `app/api/**`, `app/auth/**`, `middleware.ts`, `lib/data.ts`, `lib/supabase/**`, `lib/moderation.ts`, `supabase/migrations/**`, `scripts/test-rls.sql`, Vercel·Supabase 설정 |
| 디자인 토큰 / 에셋 | 디자인 (코드 반영은 클라이언트) | `app/globals.css`의 `@theme`, `lib/constants.ts`의 `ORNAMENTS`·`THEMES`, `public/` |

### 2.2 팀 간 계약 (바꾸려면 이 문서를 먼저 수정하고 상대에게 공유)
1. **데이터 타입**: `lib/data.ts`의 `Tree`, `OrnamentRow`, `Stats`
2. **컴포넌트 props**: `TreeScene` (`theme`, `ornaments`, `season`, `onOrnamentClick`, `starMode`, `crying`, `lockedIcons`), `TreeView` (`tree`, `ornaments`, `letters`, `isOwner`, `isLoggedIn`, `season`, `revealAt`, `shareUrl`, `justAdded`, `egg`, `demo`)
3. **API**: 아래 5장 `POST /api/letters`
4. **장식 ID**: `lib/constants.ts`의 장식 `id`는 DB `letters.ornament_type`에 저장된다. **이미 쓰인 id는 바꾸거나 지우지 않는다** (아이콘 이미지만 교체).

## 3. 사용자 흐름

### 트리 주인
1. 홈 → 카카오/구글 로그인 → **이름만 입력**해 트리 생성 (트리 이름은 자동으로 "OO님의 트리")
2. 트리 링크 공유 (Web Share / 링크 복사 / 스토리용 이미지 저장)
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
- **익명**: 작성자 계정을 저장하지 않음. IP는 솔트 해시(`ip_hash`)만 저장, 누구에게도 노출하지 않음.
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
- 같은 IP: 분당 5개, 한 트리에 하루 10개
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
응답
- `200 { "ok": true }` (데모 모드는 `{ "ok": true, "demo": true }`)
- `400 { "error": "..." }` 장식 id 오류 / 길이 / 금칙어
- `404` 트리 없음 · `429` 작성 제한 초과 · `500` 저장 실패

### 5.3 데이터 모델 (`supabase/migrations/0001_init.sql`)
- `app_config(reveal_at)` — 공개 시각 (기본 `2026-12-25 00:00+09`)
- `profiles(id, display_name, is_admin)`
- `trees(id, owner_id, slug, title, owner_name, theme, department, kind[user|professor|special], description, claim_code)` — 일반 유저 1인 1트리
- `letters(id, tree_id, ornament_type, nickname, content, is_confession, ip_hash, reported, hidden, created_at)`
- RPC: `get_ornaments(tree_id)`(본문·고백 여부 제외), `get_stats()`, `report_letter`, `claim_tree`, `admin_*`

## 6. 미정 / 범위 밖
- 포닉스: 학교 공식 캐릭터 이미지를 쓰려면 사용 허락 필요. 현재는 직접 그린 오리지널 불새.
- 도메인 (기본은 `*.vercel.app`)
- 크리스마스 이후 서비스 종료/보관 정책
- 범위 밖: 모바일 네이티브 앱, 실시간 알림, 편지 답장
