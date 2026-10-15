import { useEffect } from 'react'
import { View, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useReducedMotion } from './motion'

/** 한 번 밝아졌다 어두워지는 데 걸리는 시간(ms). */
const PULSE_MS = 1400

/**
 * 로딩 자리를 채우는 뼈대.
 *
 * 스피너는 "기다려"만 말하고 무엇이 올지 알려주지 않는다. 뼈대는 레이아웃을
 * 미리 그려서 도착 순간에 화면이 튀지 않게 하고, 체감 대기시간을 줄인다.
 * 밝기만 오가는 펄스라 UI 스레드에서 돌아 비용이 거의 없다.
 * 동작 줄이기를 켠 사람에게는 깜빡이지 않는 고정 밝기로 보여준다.
 */
export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const reduced = useReducedMotion()
  const opacity = useSharedValue(reduced ? 0.7 : 0.45)

  useEffect(() => {
    if (reduced) {
      opacity.set(0.7)
      return
    }
    // 반복하는 왕복 운동이라 등속에 가까운 sine을 쓴다(ease-out은 끝에서 멈칫한다).
    opacity.set(
      withRepeat(
        withTiming(1, { duration: PULSE_MS / 2, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    )
  }, [opacity, reduced])

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }))

  return (
    <Animated.View style={[pulse, style]}>
      <View className="h-full w-full rounded-lg bg-muted" />
    </Animated.View>
  )
}
