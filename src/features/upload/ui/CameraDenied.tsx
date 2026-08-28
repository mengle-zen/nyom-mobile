import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

/**
 * 카메라를 쓸 수 없을 때의 폴백 (권한 거부 / 시뮬레이터처럼 장치가 없는 경우).
 * 웹의 CameraDenied와 같은 결이지만, 막다른 길로 두지 않고 갤러리 진입점을
 * 여기서도 바로 제공한다 — 사진을 올리는 길이 하나 더 있는데 화면 밖에만 있으면
 * 사용자는 못 찾는다.
 */
export function CameraDenied({
  onRetry,
  onPickGallery,
  reason,
}: {
  onRetry: () => void
  onPickGallery: () => void
  /** 안내 문구 — 권한 거부인지 장치 부재인지에 따라 다르다 */
  reason: string
}) {
  return (
    <View className="items-center gap-4">
      <View className="size-[88px] items-center justify-center rounded-full bg-white/10">
        <Ionicons name="camera-outline" size={40} color="rgba(255,255,255,0.7)" />
      </View>

      <View className="items-center gap-1.5">
        <Text className="text-lg font-bold text-white">
          카메라를 사용할 수 없어요
        </Text>
        <Text className="w-[280px] text-center text-sm leading-5 text-white/65">
          {reason}
        </Text>
      </View>

      <View className="mt-1 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="rounded-full bg-white/15 px-5 py-2.5 active:opacity-70"
        >
          <Text className="font-bold text-white">다시 시도</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="갤러리에서 사진 고르기"
          onPress={onPickGallery}
          className="flex-row items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 active:opacity-80"
        >
          <Ionicons name="images-outline" size={16} color="#fff" />
          <Text className="font-bold text-primary-foreground">갤러리에서 고르기</Text>
        </Pressable>
      </View>
    </View>
  )
}
