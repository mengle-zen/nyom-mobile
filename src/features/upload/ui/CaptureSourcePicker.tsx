import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

/**
 * 사진 출처 선택 — OS 카메라 / 갤러리.
 *
 * 사진은 보통 카메라 버튼의 선택창(`PhotoSourceSheet`)에서 골라 오므로 이 화면은
 * 정상 경로에서는 보이지 않는다. 사진 없이 올리기 화면에 들어왔을 때(링크 등)만 보인다.
 * 촬영과 갤러리를 같은 크기로 나란히 둔다.
 */
export function CaptureSourcePicker({
  onOpenCamera,
  onPickGallery,
  disabled,
}: {
  onOpenCamera: () => void
  onPickGallery: () => void
  disabled: boolean
}) {
  return (
    <View className={`gap-3 px-6 ${disabled ? 'opacity-50' : ''}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="카메라로 촬영"
        accessibilityState={{ disabled }}
        onPress={onOpenCamera}
        disabled={disabled}
        className="flex-row items-center justify-center gap-2 rounded-full bg-primary h-control px-5 active:opacity-80"
      >
        <Ionicons name="camera" size={20} color="#fff" />
        <Text className="text-base font-bold text-primary-foreground">카메라로 촬영</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="갤러리에서 고르기"
        accessibilityState={{ disabled }}
        onPress={onPickGallery}
        disabled={disabled}
        className="flex-row items-center justify-center gap-2 rounded-full bg-white/15 h-control px-5 active:opacity-70"
      >
        <Ionicons name="images-outline" size={20} color="#fff" />
        <Text className="text-base font-bold text-white">갤러리에서 고르기</Text>
      </Pressable>
    </View>
  )
}
