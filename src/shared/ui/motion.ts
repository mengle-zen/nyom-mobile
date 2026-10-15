import { useEffect, useRef } from 'react'
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

/**
 * 앱 전체가 쓰는 모션 값. 화면마다 곡선을 따로 고르면 같은 앱 안에서 감각이 갈린다.
 *
 * - EASE_OUT: 들어오고 나가는 것, 눌림 반응. 처음이 빨라 "바로 반응했다"로 읽힌다.
 * - EASE_IN_OUT: 화면 위에서 자리를 옮기는 것(인디케이터 등).
 *
 * `ease-in`은 쓰지 않는다 — 사용자가 지켜보는 첫 순간을 늦춘다.
 * 아직 RN 기본 `Animated`로 도는 곳(보드 스와이프)은 `EASE_OUT_BEZIER`로 같은 곡선을 쓴다.
 */
export const EASE_OUT_BEZIER = [0.23, 1, 0.32, 1] as const
export const EASE_OUT = Easing.bezier(...EASE_OUT_BEZIER)
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1)

/** 눌림 반응·작은 상태 변화. 150ms를 넘기면 "느리다"로 느껴진다. */
export const DURATION_PRESS = 120
/** 인디케이터처럼 화면 위에서 옮겨 가는 것. */
export const DURATION_MOVE = 250

export { useReducedMotion }

/**
 * 선택 표시(알약)를 `left`로 옮기는 translateX.
 *
 * 탭으로 옮기는 것이라 손가락의 운동량이 없다 — 스프링으로 튕기지 않고
 * ease-in-out으로 정확히 멈춘다. 첫 렌더는 제자리에서 시작하고(딥링크로 저녁부터
 * 열리는 경우 등), 동작 줄이기를 켠 사람에게는 미끄러지지 않고 바로 옮긴다
 * (색·굵기 변화가 상태를 계속 알려 준다).
 */
export function useSlideX(left: number) {
  const reduced = useReducedMotion()
  const x = useSharedValue(left)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    x.set(
      reduced
        ? left
        : withTiming(left, { duration: DURATION_MOVE, easing: EASE_IN_OUT }),
    )
  }, [left, reduced, x])

  return x
}
