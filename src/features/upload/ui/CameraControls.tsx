import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

/** 라이브 뷰파인더 하단 컨트롤 — 갤러리 / 셔터 / 전후면 전환 */
export function CameraControls({
  canCapture,
  onPickGallery,
  onCapture,
  onToggleFacing,
}: {
  canCapture: boolean
  onPickGallery: () => void
  onCapture: () => void
  onToggleFacing: () => void
}) {
  return (
    <View className="flex-row items-center justify-between px-11">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="갤러리에서 선택"
        onPress={onPickGallery}
        className="size-[52px] items-center justify-center rounded-md bg-white/15 active:opacity-70"
      >
        <Ionicons name="images-outline" size={24} color="#fff" />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="촬영"
        accessibilityState={{ disabled: !canCapture }}
        onPress={onCapture}
        disabled={!canCapture}
        className={`size-[78px] items-center justify-center rounded-full border-4 border-white active:opacity-70 ${
          canCapture ? '' : 'opacity-40'
        }`}
      >
        <View className="size-[62px] rounded-full bg-white" />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="카메라 전환"
        onPress={onToggleFacing}
        className="size-12 items-center justify-center rounded-full bg-white/15 active:opacity-70"
      >
        <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
      </Pressable>
    </View>
  )
}
