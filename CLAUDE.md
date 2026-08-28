# nyom-mobile

뇸(Nyom) 모바일 앱. 웹앱 [hyorish03/nyom](https://github.com/hyorish03/nyom)의 React Native 이식판.

## 이 프로젝트를 만질 때 알아야 할 것

### 백엔드는 웹과 공유한다

Supabase 스키마·RLS·RPC·Edge Function은 **nyom(웹) 저장소가 소유한다.**
여기서 마이그레이션이 필요해지면 파일만 작성해 두고 적용하지 말고, 웹 저장소에서 처리한다.

### 순수 로직은 웹과 같은 파일이다

`entities/post/{board,date-range,dedupe,deeplink,edit}.ts`, `entities/reaction/toggle.ts`,
`features/board-nav/axis.ts`, `features/calendar/lib/month.ts`는 웹에서 그대로 가져왔고
테스트 파일도 같다. **여기서 고치면 웹과 갈라진다** — 양쪽에 반영할지 먼저 판단할 것.

한 곳은 의도적으로 다르다: `defaultSlotForHour`가 새벽 0~4시를 `late_snack`으로 본다.
웹은 아직 `hour < 11`을 통째로 아침으로 잡는다(고쳐야 할 버그).

### 함정 (실제로 밟은 것들)

- **NativeWind는 함수형 `style` prop을 조용히 버린다.** `style={({pressed}) => ({…})}`를 쓰면
  스타일이 통째로 사라진다. `TouchableOpacity` + 정적 style + `activeOpacity`를 쓸 것.
- **`expo-file-system@57`의 기본 진입점에는 `readAsStringAsync`가 없다.** 새 API(`File`/`Paths`)만
  내보낸다. 레거시 함수가 필요하면 `expo-file-system/legacy`에서 import.
- **`expo-image`는 Expo Go에서 로컬 `file://`을 못 읽는다.** ImageManipulator 캐시 미리보기는
  RN 기본 `Image`를 쓸 것. 원격 signed URL은 `expo-image`로 괜찮다.
- **RN `Pressable`은 요소 안에 머물면 이동 거리와 무관하게 `onPress`를 쏜다.** 스와이프 위에
  얹힌 탭 대상은 `onPressIn`↔`onPress` 이동 거리를 재서 걸러야 한다(`useTapOnly` 참고).
- **`getLastNotificationResponseAsync()`는 앱을 껐다 켜도 같은 값을 돌려준다.** 처리 여부를
  메모리에만 두면 실행할 때마다 오래된 알림이 재생된다. AsyncStorage로 영속화할 것.
- **pnpm에서 `react-native-css-interop`이 호이스팅되지 않는다.** NativeWind의 전이 의존인데
  직접 의존으로 넣어야 번들이 된다.

## 구조 (FSD, 웹과 동일)

```
src/
  app/          expo-router 라우트 — 얇은 래퍼만
  entities/     post · group · reaction
  features/     auth · group · upload · profile · notifications · post-edit · board-nav · calendar
  widgets/      board-header · slot-chips · slot-board · meal-tile · post-detail · day-picker
  shared/       supabase 클라이언트, 쿼리 키, 공용 UI·유틸
```

## 작업 방식

**이 저장소가 앞으로의 주 작업 대상이다.** 웹앱(nyom)은 유지보수만 하고 신규 작업은 여기서 한다.

**브랜치 → PR → 머지.** `main`에 직접 커밋하지 않는다.
초기 두 커밋(이식·카메라 전환)은 빈 저장소라 base가 없어 main에 바로 들어갔고,
그 이후로는 PR을 쓴다. 히스토리를 소급해 고치지는 않았다.

커밋 메시지는 한국어 conventional commit. 마지막 줄에
`Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

### 백엔드가 필요한 작업은 여기서 끝나지 않는다

Supabase 스키마·RLS·RPC·Edge Function은 **nyom(웹) 저장소가 소유한다.**
모바일 기능이 백엔드 변경을 요구하면 마이그레이션 파일을 여기 두지 말고
웹 저장소에서 처리해야 한다. 대표적인 미해결 건이 푸시 발송 경로다(아래 「미해결」).

## 명령

```bash
pnpm start                 # Metro
pnpm ios                   # iOS 시뮬레이터
pnpm exec vitest run       # 순수 로직 테스트
pnpm exec tsc --noEmit     # 타입 검사
```

로컬 백엔드는 웹 저장소에서 `pnpm dlx supabase start`.
`.env.local`은 `.env.example` 참고. 실기기는 `127.0.0.1` 대신 LAN IP를 써야 한다.

## 미해결

`README.md`의 「알려진 이슈」 참고. 가장 큰 것은 **푸시 발송 경로가 연결되지 않은 것** —
웹은 VAPID/WebPush, 네이티브는 Expo push token이라 기존 `send-push` Edge Function으로는
이 앱에 알림이 가지 않는다.
