import type { ViewStyle } from 'react-native'

/**
 * 그림자 토큰.
 *
 * 왜 필요한가: 웹앱에는 웜톤 그림자 스케일이 있는데(`--shadow-sm` ~ `--shadow-xl`,
 * `rgba(92, 38, 7, …)`) 모바일로 이식되지 않았다. 그래서 다섯 곳이 각자 손으로
 * 값을 썼고, 색(`#5C2607`)만 우연히 같고 offset·opacity·radius는 전부 달랐다.
 * `elevation`이 빠진 곳도 있어 **안드로이드에서는 그림자가 아예 안 보였다.**
 *
 * 왜 NativeWind의 `shadow-*` 클래스를 쓰지 않는가: RN 그림자는 CSS `box-shadow`가
 * 아니라 개별 prop(iOS)과 `elevation`(Android)이다. Tailwind 기본 클래스는 중성
 * 검정 그림자를 만들어 이 앱의 웜톤과 어긋나고 `elevation`을 함께 주지 못한다.
 * 실제로 탐색 탭만 `shadow-sm` 클래스를 써서 내 그룹 탭과 그림자가 달라 보였다.
 *
 * 이름은 크기(sm/md/lg)가 아니라 **역할**로 둔다. 역할로 부르면 새 컴포넌트가
 * 어느 값을 쓸지 바로 알 수 있다.
 *
 * 값은 기존 화면을 기준으로 정리했다 — 웹 스케일로 갈아끼우면 다섯 화면의 모습이
 * 한꺼번에 바뀌므로, 지금 가장 정제된 값(카드는 GroupListItem, 컨트롤은
 * segmented-control)을 표준으로 승격시켰다.
 */
const WARM = '#5C2607'

/** 배경에서 살짝 떠 있는 카드. 그룹 목록·탐색 목록·스켈레톤. */
export const CARD_SHADOW: ViewStyle = {
  shadowColor: WARM,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 1,
}

/** 눌리는 작은 컨트롤. 세그먼트 인디케이터, 주요 버튼. */
export const CONTROL_SHADOW: ViewStyle = {
  shadowColor: WARM,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.12,
  shadowRadius: 3,
  elevation: 2,
}

/** 콘텐츠 위에 확실히 떠 있는 것. 탭바 FAB. */
export const FLOATING_SHADOW: ViewStyle = {
  shadowColor: WARM,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.18,
  shadowRadius: 10,
  elevation: 4,
}

/** 화면의 주인공. 로그인·온보딩의 큰 로고. */
export const HERO_SHADOW: ViewStyle = {
  shadowColor: WARM,
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.2,
  shadowRadius: 18,
  elevation: 8,
}
