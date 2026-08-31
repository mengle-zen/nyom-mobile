import { useEffect, useState } from 'react'
import { Animated, View, type ViewStyle } from 'react-native'

/**
 * 로딩 자리를 채우는 뼈대.
 *
 * 스피너는 "기다려"만 말하고 무엇이 올지 알려주지 않는다. 뼈대는 레이아웃을
 * 미리 그려서 도착 순간에 화면이 튀지 않게 하고, 체감 대기시간을 줄인다.
 * 밝기만 오가는 펄스라 네이티브 드라이버로 돌 수 있어 비용이 거의 없다.
 */
export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const opacity = useState(() => new Animated.Value(0.45))[0]

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return (
    <Animated.View style={[{ opacity }, style]}>
      <View className="h-full w-full rounded-lg bg-muted" />
    </Animated.View>
  )
}
