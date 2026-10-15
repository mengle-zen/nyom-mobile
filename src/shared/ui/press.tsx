import { useCallback, useRef } from 'react'
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { decideAxis } from '@/features/board-nav'
import { DURATION_PRESS, EASE_OUT, useReducedMotion } from './motion'

/** 눌렀을 때 줄어드는 정도. 값이 작을수록 반응이 커 보인다. */
const PRESS_SCALE = 0.97
/** 동작 줄이기를 켠 사람에게는 크기 대신 밝기로 눌림을 알린다. */
const PRESS_OPACITY = 0.85

export type HapticKind =
  | 'light'
  | 'medium'
  | 'success'
  | 'warning'
  | 'error'
  | 'select'

/**
 * 햅틱은 "내가 뭔가를 바꿨다"는 순간에만 준다.
 * 화면 이동이나 조회에까지 붙이면 진동이 배경 소음이 되어 의미를 잃는다.
 */
export async function haptic(kind: HapticKind = 'light') {
  try {
    switch (kind) {
      case 'select':
        return await Haptics.selectionAsync()
      case 'medium':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      case 'success':
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      case 'warning':
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      case 'error':
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      default:
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  } catch {
    // 기기가 햅틱을 지원하지 않거나 시뮬레이터인 경우. 조용히 넘어간다.
  }
}

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  /**
   * 감싸는 Animated.View에 얹힌다(transform과 같은 노드여야 스케일이 먹는다).
   *
   * ⚠️ 그래서 여기에 `padding`을 주면 **그 여백은 터치 영역에서 빠진다** —
   * 아이콘 크기만 과녁이 되어 옆 행이 눌리는 일이 생긴다. 과녁을 넓히려면
   * 여백을 children 쪽 View에 주거나 `hitSlop`을 쓸 것.
   */
  style?: ViewStyle | ViewStyle[]
  /** 누를 때 줄 햅틱. `null`이면 주지 않는다(단순 이동 등). 기본 'light'. */
  hapticKind?: HapticKind | null
  /**
   * 스와이프 위에 얹힌 대상이면 true. RN Pressable은 요소 안에 머물면 이동 거리와
   * 무관하게 onPress를 쏘기 때문에, 끼니를 넘기려던 스와이프가 상세를 열어버린다.
   * onPressIn↔onPress 사이 이동 거리를 재서 제스처였으면 무시한다.
   */
  swipeSafe?: boolean
}

/**
 * 누르면 살짝 줄어들고 햅틱이 오는 Pressable.
 *
 * 토스류 앱의 "눌린 게 느껴진다"는 감각은 대부분 이 두 가지에서 온다 —
 * 즉각적인 스케일 반응과 짧은 햅틱. 화면마다 따로 만들면 감각이 갈리므로
 * 여기 한 곳에 둔다.
 */
export function PressableScale({
  style,
  hapticKind = 'light',
  swipeSafe = false,
  onPress,
  onPressIn,
  onPressOut,
  pressRetentionOffset = 16,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion()
  /** 0 = 놓임, 1 = 눌림. 스케일·밝기는 여기서 파생한다(UI 스레드). */
  const pressed = useSharedValue(0)
  const from = useRef<{ x: number; y: number } | null>(null)

  const pressStyle = useAnimatedStyle(() => {
    const p = pressed.get()
    return reduced
      ? { opacity: 1 - (1 - PRESS_OPACITY) * p }
      : { transform: [{ scale: 1 - (1 - PRESS_SCALE) * p }] }
  })

  const animate = useCallback(
    (to: 0 | 1) => {
      pressed.set(withTiming(to, { duration: DURATION_PRESS, easing: EASE_OUT }))
    },
    [pressed],
  )

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      from.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
      animate(1)
      onPressIn?.(e)
    },
    [animate, onPressIn],
  )

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      animate(0)
      onPressOut?.(e)
    },
    [animate, onPressOut],
  )

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (swipeSafe && from.current) {
        const dx = e.nativeEvent.pageX - from.current.x
        const dy = e.nativeEvent.pageY - from.current.y
        // 임계를 넘겼으면 탭이 아니라 스와이프였다.
        if (decideAxis(dx, dy, 10) !== null) return
      }
      if (hapticKind) void haptic(hapticKind)
      onPress?.(e)
    },
    [hapticKind, onPress, swipeSafe],
  )

  return (
    <Animated.View style={[pressStyle, style]}>
      <Pressable
        {...rest}
        // 손가락이 몇 px 흘러도 누르려던 의도를 취소하지 않는다.
        pressRetentionOffset={pressRetentionOffset}
        onPressIn={handlePressIn}
        onPress={handlePress}
        onPressOut={handlePressOut}
      />
    </Animated.View>
  )
}
