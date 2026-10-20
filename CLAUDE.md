# nyom-mobile

뇸(Nyom) 모바일 앱. 웹앱 [mengle-zen/nyom](https://github.com/mengle-zen/nyom)의 React Native 이식판.

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
- **`Linking.createURL()`은 dev server에 붙은 빌드에서 패키저 호스트를 URL 호스트로 끼워 넣는다.**
  `nyom://auth/callback`이 아니라 `nyom://192.168.0.10:8081/auth/callback`이 나온다. OAuth
  리디렉트에 쓰면 Supabase 허용목록에 없어 조용히 무시되고 Site URL(웹앱)로 되돌려져서, 로그인에
  성공해도 앱이 아니라 브라우저에 착지한다. 프로덕션 빌드에서는 `hostUri`가 비어 정상 동작하므로
  개발 중에만 재현된다. 리디렉트 주소는 스킴으로 직접 만들 것(`features/auth/context.tsx` 참고).
- **pnpm에서 `react-native-css-interop`이 호이스팅되지 않는다.** NativeWind의 전이 의존인데
  직접 의존으로 넣어야 번들이 된다.
- **릴리스 번들(Xcode 아카이브)은 `babel-preset-expo`·`@babel/plugin-transform-react-jsx`가
  직접 의존이어야 한다.** dev 서버에서는 우연히 찾아져서 개발 중엔 안 보이고, 아카이브의
  `export:embed` 단계에서만 `Cannot find module`로 깨진다. css-interop의 babel 설정이 jsx
  플러그인을 이름으로만 부르면서 의존성에 선언하지 않은 탓이다.
- **Xcode 27(iOS 27 SDK)로 빌드하면 UIScene 생명주기가 필수다.** 없으면 iOS 27 기기에서 실행 즉시
  SIGTRAP으로 꺼진다(iOS 18에선 멀쩡해서 놓치기 쉽다). Expo 57.0.29의 `ExpoAppSceneDelegate`를
  `plugins/with-scene-lifecycle.js`가 켠다. Expo 템플릿이 scene을 기본으로 갖추면 플러그인을 지울 것.
  릴리스 빌드는 iOS 27 시뮬레이터에서 한 번 띄워 보고 올린다.
- **Xcode를 올리면 `ExpoModulesJSI` 캐시부터 지운다.** 이 xcframework는 빌드 때 이 Mac에서
  만들어지는데, 소스 해시가 같으면 예전 Xcode로 만든 결과를 재사용한다. Xcode 27.0 → 27.1 뒤
  아카이브가 `cannot find type '__ObjC::expo'`로 깨졌다(미리 빌드한 모듈을 꺼도 그대로).
  `rm -rf node_modules/.pnpm/expo-modules-jsi@*/node_modules/expo-modules-jsi/apple/Products/ExpoModulesJSI.xcframework`
  후 `expo prebuild --clean`. 시뮬레이터 Release 빌드는 `ONLY_ACTIVE_ARCH=YES ARCHS=arm64`로.
- **의존성을 바꾼 뒤엔 `expo prebuild --clean`부터.** pnpm 경로 해시가 바뀌어 Pods가 옛 경로를
  가리키고 `PrivacyInfo.xcprivacy` 등을 못 찾는다. prebuild는 `package.json`의 `ios`/`android`
  스크립트를 `expo run:*`으로 바꿔 놓으니 되돌릴 것.

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

**PR 없이 `main`에 바로 커밋·푸시한다.** (2026-10-15부터. 그 전까지는 #13까지 PR로 머지했다.)
`main`은 다른 워크트리가 체크아웃하고 있을 수 있으니, 워크트리에서는
`origin/main` 위에서 커밋한 뒤 `git push origin HEAD:main`으로 올린다.

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

## e2e (Maestro)

`.maestro/flows/`에 로그인 → 그룹 → 보드 → 프로필 → 올리기 다섯 흐름이 있다. **실제 서버**를 쓰고,
테스트 계정(`EXPO_PUBLIC_TEST_LOGIN_*`)으로 로그인한다. 테스트 계정은 **혼자인 비공개 그룹 「E2E 전용」
하나에만** 속한다(2026-10-20 정리 — 친구들 그룹에 테스트 기록이 보이지 않게). 다른 그룹에 넣지 말 것.
올리기는 그 그룹에 보내고 곧바로 되돌린다 — 나가기·강퇴처럼 되돌릴 수 없는 동작은 흐름에 넣지 않는다.

1. Maestro CLI: `~/.maestro/bin/maestro` (셸 설정 파일은 건드리지 않고 릴리스 zip만 풀어 둠)
2. 테스트 계정 버튼이 보이는 Release 시뮬레이터 빌드 — **env를 비우지 않고** 빌드해 설치한다:
   `xcodebuild … -configuration Release -sdk iphonesimulator ONLY_ACTIVE_ARCH=YES ARCHS=arm64 build`
   후 `xcrun simctl install`. (TestFlight용 빌드는 env를 비운다 — 아래 「TestFlight 업로드」)
3. `MAESTRO_CLI_NO_ANALYTICS=1 ~/.maestro/bin/maestro --device <iOS 27 시뮬레이터 id> test .maestro`

iOS 27 시뮬레이터에는 가상 카메라가 있어 카메라가 실제로 뜨지만, 셔터를 눌러도 사진은 안 나온다.
올리기 흐름은 카메라가 뜨는 것(무한 로딩 회귀)까지 확인하고 닫은 뒤 갤러리 경로로 이어 간다.
갤러리에 사진이 없으면 `xcrun simctl addmedia <id> <사진>`으로 넣어 둔다.

## TestFlight 업로드

번들 ID `nyom.mengle.zen`, 팀 `8V5VNMF9JM`, App Store Connect API 키는
`~/.appstoreconnect/private_keys/`의 `R6UDW8VG95`(issuer `f8f947ed-9d55-48a8-b7eb-2dce3c6407fc`).
올리기 전에 `app.json`의 `ios.buildNumber`를 올린다(같은 번호는 거부된다).

1. `npx expo prebuild --platform ios --clean` (스크립트 되돌리기)
2. `EXPO_PUBLIC_TEST_LOGIN_EMAIL= EXPO_PUBLIC_TEST_LOGIN_PASSWORD= xcodebuild … archive`
   — 테스트 계정 정보가 번들에 박히지 않게 비운다. 서명은 `-allowProvisioningUpdates`와
   `-authenticationKey*`로 자동.
3. `xcodebuild -exportArchive` (method `app-store-connect`, **destination `export`**) →
   `xcrun altool --upload-app --apiKey … --apiIssuer …`.
   destination `upload`는 "No Accounts with App Store Connect Access"로 실패한다.

## 미해결

`README.md`의 「알려진 이슈」 참고. 가장 큰 것은 **푸시 발송 경로가 연결되지 않은 것** —
웹은 VAPID/WebPush, 네이티브는 Expo push token이라 기존 `send-push` Edge Function으로는
이 앱에 알림이 가지 않는다.
