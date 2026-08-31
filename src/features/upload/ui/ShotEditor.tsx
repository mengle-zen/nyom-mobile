import { Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { MealSlotKey } from '@/entities/post'
import { MealSlotChips } from '@/entities/post/ui/MealSlotChips'
import { TimeStepper } from '@/shared/ui/TimeStepper'

/** 촬영/선택 후 1단계 — 끼니 · 섭취시각 · 메모 (그룹 선택은 다음 단계) */
export function ShotEditor({
  slot,
  onSlotChange,
  recordedTime,
  onRecordedTimeChange,
  maxTime,
  caption,
  onCaptionChange,
  onRetake,
  onNext,
}: {
  slot: MealSlotKey
  onSlotChange: (slot: MealSlotKey) => void
  /** 섭취 시각 'HH:mm' (오늘 기준) */
  recordedTime: string
  onRecordedTimeChange: (hhmm: string) => void
  /** 선택 가능한 최대 시각(현재 시각) 'HH:mm' */
  maxTime: string
  caption: string
  onCaptionChange: (v: string) => void
  onRetake: () => void
  onNext: () => void
}) {
  return (
    <View className="gap-3 px-6">
      <MealSlotChips value={slot} onChange={onSlotChange} />

      {/* 라벨은 스테퍼 밖에 둔다 — 안에 두면 값과 버튼이 한쪽으로 밀려 대칭이 깨진다. */}
      <View className="gap-1.5">
        <Text className="text-xs font-medium text-white/70">섭취 시각</Text>
        <TimeStepper
          value={recordedTime}
          max={maxTime}
          onChange={onRecordedTimeChange}
        />
      </View>

      <TextInput
        value={caption}
        onChangeText={onCaptionChange}
        maxLength={100}
        placeholder="한 줄 메모를 남겨보세요 (선택)"
        placeholderTextColor="rgba(255,255,255,0.5)"
        accessibilityLabel="한 줄 메모"
        returnKeyType="done"
        className="rounded-full bg-white/15 px-4 py-3 text-sm text-white"
      />

      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={onRetake}
          className="flex-row items-center gap-2 rounded-full bg-white/15 px-5 py-3.5 active:opacity-70"
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text className="font-bold text-white">다시 찍기</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onNext}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-3.5 active:opacity-80"
        >
          <Text className="font-bold text-primary-foreground">다음</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  )
}
