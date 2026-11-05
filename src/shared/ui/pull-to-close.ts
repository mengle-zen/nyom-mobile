import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { DURATION_DISMISS, DURATION_MOVE, EASE_OUT, useReducedMotion } from './motion'

/** 이만큼 끌어내리거나(화면 높이의 20%, 최대 140pt) 빠르게 튕기면 닫는다. */
const DISMISS_RATIO = 0.2
const DISMISS_MAX = 140
const DISMISS_VELOCITY = 800

type Options = {
  /**
   * 닫기로 정했을 때의 움직임.
   * - 'slide'(기본): 화면 아래로 밀어낸 뒤 onClose
   * - 'none': 제자리로 돌려놓고 onClose — onClose가 확인을 물을 수 있을 때(올리기 화면)
   *   밀어낸 채 「계속 기록」을 고르면 화면이 사라진 채 남는다.
   */
  exit?: 'slide' | 'none'
  /** 끝까지 끌어내렸을 때 작아지는 정도(사진 상세 0.15). 시트는 0 */
  shrink?: number
}

/**
 * 아래로 끌어내려 닫기 — 사진 상세·시트·올리기 화면이 같이 쓴다.
 *
 * `gesture`를 끌 손잡이(헤더·사진 영역 등)에 GestureDetector로 붙이고, `style`을 움직일
 * 덩어리(시트·화면)에 붙인다. 아래로만 시작하고 가로 움직임은 실패시켜 안의 가로 넘기기를
 * 막지 않는다. 안에 세로 스크롤이 있으면 손잡이를 스크롤 밖에 둔다.
 * Modal 안에서 쓰면 Android는 Modal 안에 GestureHandlerRootView가 따로 있어야 한다.
 */
export function usePullToClose(onClose: () => void, { exit = 'slide', shrink = 0 }: Options = {}) {
  const { height } = useWindowDimensions()
  const reduced = useReducedMotion()
  const y = useSharedValue(0)

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // 두 손가락(사진 확대)은 받지 않는다.
        .maxPointers(1)
        .activeOffsetY(12)
        .failOffsetX([-14, 14])
        .onUpdate((e) => {
          y.set(Math.max(0, e.translationY))
        })
        .onEnd((e) => {
          const timing = { duration: DURATION_MOVE, easing: EASE_OUT }
          const commit =
            y.get() > Math.min(height * DISMISS_RATIO, DISMISS_MAX) || e.velocityY > DISMISS_VELOCITY
          if (!commit || exit === 'none' || reduced) {
            y.set(reduced ? 0 : withTiming(0, timing))
            if (commit) scheduleOnRN(onClose)
            return
          }
          y.set(
            withTiming(height, { duration: DURATION_DISMISS, easing: EASE_OUT }, (done) => {
              if (!done) return
              scheduleOnRN(onClose)
              // 닫힌 뒤에도 마운트된 채 남는 시트가 있다 — 다음에 열 때 제자리에 있게.
              y.set(withDelay(DURATION_MOVE, withTiming(0, { duration: 0 })))
            }),
          )
        }),
    [y, height, reduced, exit, onClose],
  )

  const style = useAnimatedStyle(() => {
    const p = Math.min(y.get() / height, 1)
    return { transform: [{ translateY: y.get() }, { scale: 1 - p * shrink }] }
  })

  return { gesture, style }
}
