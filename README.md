# 뇸(Nyom) — 모바일

친구들과 먹는 순간을 가볍게 기록하고 흘려보는 식사 로그 앱.
웹앱([mengle-zen/nyom](https://github.com/mengle-zen/nyom))의 React Native 이식판이다.

## 왜 네이티브인가

웹앱을 실제로 써보고 정리한 결과([`nyom/docs/UX_FINDINGS.md`](https://github.com/mengle-zen/nyom/blob/main/docs/UX_FINDINGS.md)),
불편함의 대부분은 웹의 한계가 아니라 구현 선택의 문제였다. 결정적인 한계는 하나다:

> **iOS 웹 푸시는 PWA를 홈 화면에 추가해야만 동작한다**(16.4+).
> 브라우저 탭으로 쓰는 iOS 사용자에게는 알림이 아예 가지 않는다.

뇸의 리텐션은 알림(게시·반응·리마인더)에 걸려 있어서, 이 제약은 제품의 핵심 장치를
사용자 상당수에게서 통째로 없앤다. 카메라 품질(HDR·나이트모드·볼륨 셔터)과
백그라운드 업로드는 부차적인 이유다.

## 기술 스택

- **Expo SDK 57** / React Native 0.86 / React 19
- **expo-router** — 파일 기반 라우팅 (`src/app/`)
- **NativeWind v4** — 웹과 같은 Tailwind 클래스. 디자인 토큰은 `tailwind.config.js`에 이식
- **TanStack Query** — 데이터 페칭·캐싱 (웹과 동일한 쿼리 키)
- **Supabase** — Auth / DB / Storage. **백엔드는 웹과 같은 프로젝트를 그대로 쓴다**
- **FSD**(Feature-Sliced Design) — 웹과 같은 레이어 구조
- **vitest** — 순수 로직 테스트. 웹과 같은 테스트 파일이 그대로 돈다

## 웹에서 그대로 가져온 것

순수 로직은 플랫폼 의존이 없어 **한 줄도 고치지 않고** 옮겨졌다.

| 모듈 | 내용 |
| --- | --- |
| `entities/post/board.ts` | 끼니 슬롯 버킷팅, 타일 매핑 |
| `entities/post/date-range.ts` | 날짜 범위·라벨 유틸 |
| `entities/post/dedupe.ts` | batch 기준 중복 제거 |
| `entities/post/deeplink.ts` | 알림 딥링크 파싱 |
| `entities/post/edit.ts` | 사후 편집 그룹 diff |
| `entities/reaction/toggle.ts` | 1인 1리액션 토글 |
| `features/board-nav/axis.ts` | 제스처 축·가장자리 판정 |
| `features/calendar/lib/month.ts` | 월 그리드 |

플랫폼 의존은 **세 곳**뿐이었다 — 이미지 업로드의 `Blob`과 `crypto.randomUUID()` 2회.

## 이식하면서 고친 것

웹 실사용에서 찾은 문제를 여기서는 처음부터 바르게 만들었다.

- **새벽 끼니 오분류** — 웹은 `hour < 11`을 통째로 아침으로 잡아 새벽 1시 라면이 "아침"이 됐다.
  `0 ≤ hour < 5`를 밤참(지금은 간식)으로 고치고 경계값 테스트를 붙였다(웹에는 이 함수 테스트가 아예 없었다).
- **끼니 이동이 발견 불가능** — 웹은 보이지 않는 좌우 30% 가장자리 탭이 유일했다. 끼니 칩을 노출.
- **사진 탭이 끼니를 바꿈** — 웹은 사진 타일이 제스처 영역과 겹쳐 친구 사진을 탭하면 끼니가 넘어갔다.
- **날짜 이동 시 끼니 리셋** — 슬롯을 유지하도록.
- **업로드 후 보드로 못 돌아감** — 웹은 그룹 목록으로 튕겨 방금 올린 기록을 못 봤다.
- **로그인 후 화면이 안 넘어감** — 웹은 라우터 context 변경이 가드를 재실행하지 않는 구조였다.
  RN에서는 세션을 렌더 트리 상태로 두고 `AuthGate`가 이동시킨다.

## 로컬 실행

### 1. 백엔드

웹 리포의 Supabase 프로젝트를 그대로 쓰거나, 로컬 스택을 띄운다.

```bash
cd ../nyom && pnpm dlx supabase start
```

### 2. 환경변수

```bash
cp .env.example .env.local
```

| 변수 | 설명 |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) |
| `EXPO_PUBLIC_TEST_LOGIN_EMAIL` | (선택) 개발용 로그인 버튼 노출 |
| `EXPO_PUBLIC_TEST_LOGIN_PASSWORD` | (선택) 위와 함께 있어야 버튼이 뜬다 |

> **실기기에서 로컬 스택에 붙으려면** `127.0.0.1` 대신 개발 머신의 LAN IP를 써야 한다.
> 폰에게 localhost는 폰 자신이다.

### 3. 실행

```bash
pnpm install
```

| 명령 | 설명 |
| --- | --- |
| `pnpm start` | Metro 개발 서버 |
| `pnpm ios` | iOS 시뮬레이터로 실행 |
| `pnpm android` | Android 에뮬레이터로 실행 |
| `pnpm exec vitest run` | 순수 로직 테스트 |
| `pnpm exec tsc --noEmit` | 타입 검사 |

## 구조

```
src/
  app/          expo-router 라우트 (얇은 래퍼)
  entities/     post · group · reaction — 도메인 모델과 쿼리
  features/     auth · group · upload · profile · notifications · board-nav · calendar
  widgets/      보드·타일·헤더 등 조합 단위 UI
  shared/       supabase 클라이언트, 쿼리 키, 공용 UI·유틸
```

## 알려진 이슈

- **푸시 발송 경로가 아직 연결되지 않았다.** 웹은 VAPID/WebPush 구독(`endpoint`/`p256dh`/`auth`)을
  저장하고 `send-push` Edge Function이 `web-push`로 보낸다. 네이티브는 Expo push token이라
  형태가 달라 **기존 Edge Function으로는 이 앱에 알림을 보낼 수 없다.**
  토큰 저장과 발송 경로 정리가 남아 있다. (아이러니하게도 네이티브로 옮긴 가장 큰 이유가 푸시다.)
- Kakao OAuth는 실제 provider 설정이 있는 환경에서만 검증 가능하다.
- iOS 시뮬레이터에는 카메라가 없고 원격 푸시 토큰도 발급되지 않는다. 촬영·푸시는 실기기 확인이 필요하다.
