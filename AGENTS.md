# nyom-mobile

친구들과 끼니 사진을 공유하는 뇸(Nyom) 모바일 앱. Expo SDK 57, React Native, Expo Router, NativeWind, TanStack Query, Supabase를 사용한다. 신규 제품 작업은 이 저장소에서 진행하며, 웹앱 `mengle-zen/nyom`과 백엔드를 공유한다.

## 실행과 검증

패키지 매니저는 `package.json`의 pnpm 버전을 따른다. CI는 Node.js 22를 사용한다.

```sh
pnpm install --frozen-lockfile
pnpm start                          # Metro 개발 서버
pnpm android                        # 개발 서버에서 Android 앱 열기
pnpm ios                            # macOS에서 iOS 앱 열기
pnpm exec expo run:android --device  # 네이티브 Android 빌드·설치, 기기 선택
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm lint
```

- 환경변수 이름은 `.env.example`을 참고하고 실제 값은 로컬 환경 파일에 둔다. 로컬 Supabase는 웹 저장소에서 실행한다. 실기기로 로컬 백엔드에 접근할 때는 PC의 LAN IP를 사용한다.
- Vitest는 Node 환경의 `src/**/*.test.ts`만 검사하며 RN 컴포넌트 테스트는 수집하지 않는다. UI·키보드·카메라 변경은 실제 실행 화면으로 별도 검증한다.
- `.github/workflows/ci.yml`은 타입·테스트·린트를 실행한다. 변경 범위에 맞춰 검증하고, 실행하지 못한 항목을 구분해 보고한다.

## 코드 위치와 변경 경계

- `src/app/`: 라우트와 화면. `_layout.tsx`가 전역 Provider와 인증 이동을 구성한다.
- `src/entities/`: post·group·reaction 모델, 순수 로직, TanStack Query 쿼리·뮤테이션.
- `src/features/`: 인증, 그룹 관리, 업로드, 프로필, 알림, 기록 편집, 보드 탐색, 달력.
- `src/widgets/`: 보드·타일·상세·날짜 선택 등 조합 UI.
- `src/shared/`: Supabase 클라이언트, 쿼리 키, 공용 UI·유틸. `@/`는 `src/` 별칭이다.
- 기존 레이어와 공용 컴포넌트를 재사용한다. 디자인 토큰은 `tailwind.config.js`, 쿼리 키는 `src/shared/api/query-keys.ts`에서 확인한다. 데이터 변경 시 관련 캐시 무효화도 확인한다.

### 백엔드와 웹앱

- Supabase 스키마·RLS·RPC·Edge Function·마이그레이션은 **웹 저장소가 소유한다**. 새 마이그레이션은 이 저장소에 만들거나 적용하지 않고 웹 저장소에서 작성·적용한다. 기존 `supabase/migrations/` 파일은 백엔드 소유권의 근거가 아니다.
- 백엔드 변경이 필요한 기능은 모바일 코드만 수정하고 완료 처리하지 않는다. 웹 저장소의 변경 필요성과 적용 여부를 명시한다.
- 웹에서 가져온 `entities/post/{date-range,dedupe}.ts`, `entities/reaction/toggle.ts`, `features/board-nav/axis.ts`, `features/calendar/lib/month.ts`를 변경할 때는 웹에도 반영할지 판단한다.
- `entities/post/{board,deeplink,edit}.ts`는 모바일 끼니 개편으로 웹과 갈라졌다. 기본 끼니는 아침·점심·저녁·간식이며 별도 이름은 `meal_tag`다. 웹과 자동으로 동기화하지 않는다.

## 반복해서 주의할 점

- NativeWind 환경에서는 `Pressable`의 함수형 `style`을 피하고 정적 스타일·기존 누름 효과를 사용한다. `pnpm-workspace.yaml`의 React Native 패치는 LogBox에도 같은 문제를 우회한다. RN 업그레이드 시 패치 필요성을 재확인한다.
- `KeyboardAvoidingView`는 iOS `padding`, Android `height`를 사용하고 flex는 `style={{ flex: 1 }}`로 지정한다. NativeWind의 `flex-1`은 내부 높이 조정용 `flex: 0`을 덮어쓴다.
- 로컬 사진 미리보기는 기존 RN `Image` 패턴을 유지한다. 파일 읽기는 Expo 57의 `File`/`Paths` API를 사용하며, 레거시 함수가 필요하면 `expo-file-system/legacy`에서 가져온다.
- 스와이프 영역 위의 탭은 `src/shared/ui/press.tsx`의 `PressableScale`에서 `swipeSafe`를 사용한다. `Pressable.onPress`만으로 탭과 스와이프를 구분하지 않는다.
- OAuth 콜백은 `src/features/auth/context.tsx`의 `nyom://auth/callback`을 유지한다. `Linking.createURL()`은 개발 서버 주소를 끼워 넣어 허용된 리디렉트와 달라질 수 있다.
- 알림 응답의 중복 처리는 `NotificationDeepLinks.tsx`처럼 AsyncStorage에 남긴다. 메모리에서만 처리하면 재실행 시 오래된 알림이 다시 열린다.
- 네이티브 설정은 `app.json`과 `plugins/`에서 수정한다. 생성된 `android/`, `ios/`는 Git에서 제외되어 있다. prebuild 후 `package.json`의 실행 스크립트가 의도치 않게 바뀌지 않았는지 확인한다.
- iOS scene 생명주기와 프레임워크 직렬 서명은 `plugins/with-scene-lifecycle.js`, `plugins/with-serial-framework-signing.js`가 담당한다. 제거·변경 전 각 파일의 원인 설명을 확인한다.
- 릴리스 번들에는 `babel-preset-expo`와 `@babel/plugin-transform-react-jsx`의 직접 의존성이 필요하다. 개발 서버에서만 성공한다고 릴리스도 성공한다고 판단하지 않는다.

## 실서버 테스트와 릴리스

- `.maestro/config.yaml`과 `.maestro/flows/`에 로그인→그룹→보드→프로필→올리기 흐름이 있다. `maestro --device <기기ID> test .maestro`로 실행한다.
- E2E는 실제 Supabase를 사용한다. 테스트 계정과 혼자인 비공개 그룹 **E2E 전용**만 사용하고, 올리기 테스트는 곧바로 되돌린다. 다른 그룹 추가·나가기·강퇴를 테스트에 넣지 않는다.
- 되돌리기 스낵바의 애니메이션이 Maestro를 지연시키면 테스트 기기의 동작 줄이기를 사용한다. 촬영과 푸시는 시뮬레이터 확인만으로 완료 처리하지 않는다.
- TestFlight 업로드 시 `app.json`의 `ios.buildNumber`를 올리고 `EXPO_PUBLIC_TEST_LOGIN_EMAIL`·`EXPO_PUBLIC_TEST_LOGIN_PASSWORD`를 비워 번들에 테스트 계정 정보가 포함되지 않게 한다. 서명 키·인증 정보·개인별 도구 경로는 지침에 복사하지 않는다.
- 현재 푸시 수신 준비와 서버 발송은 구분해야 한다. `README.md`의 알려진 이슈처럼 웹의 WebPush 발송 경로만으로 네이티브 Expo 토큰에 알림을 보낼 수 없다.

## 협업 지침과 스킬

- 공통 프로젝트 지침의 원본은 이 `AGENTS.md`다. `CLAUDE.md`는 `@AGENTS.md`로 가져온다.
- PR 생성·설명 작성에는 [.agents/skills/pr-create/SKILL.md](.agents/skills/pr-create/SKILL.md)를 적용한다.
- 공통 스킬은 `.agents/skills/`에 두고 `.claude/skills`를 `../.agents/skills` 상대 심볼릭 링크로 연결한다. `.claude/settings.json` 같은 도구별 설정은 분리한다.
- 커밋 메시지는 한국어 conventional commit 형식으로 작성한다. 공동 작성자를 표기할 때는 실제 참여한 에이전트만 기록한다.
