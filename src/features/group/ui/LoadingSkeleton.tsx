import { View } from 'react-native'

/** 그룹 목록 로딩 자리표시 */
export function LoadingSkeleton() {
  return (
    <View className="gap-2">
      {/* 웹의 animate-pulse는 NativeWind에 없다. 정지된 회색 블록으로 대체한다. */}
      {[1, 2, 3].map((i) => (
        <View key={i} className="h-16 rounded-lg bg-card opacity-60" />
      ))}
    </View>
  )
}
