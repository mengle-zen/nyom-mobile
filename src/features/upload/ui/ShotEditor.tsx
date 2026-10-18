import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { slotLabel, type MealSlotKey } from '@/entities/post'
import { MealSlotChips } from '@/entities/post/ui/MealSlotChips'
import { DarkSheet } from './DarkSheet'

/**
 * 미리보기 아래 — 끼니 · 메모 · 받는 곳 · 보내기. 이 화면 하나에서 올리기가 끝난다.
 *
 * 예전엔 끼니 칩 4개와 시각 버튼 4개가 늘 펼쳐져 있었고, 「다음」 뒤에 그룹 선택 화면이
 * 한 번 더 있었다. 대부분 기본값 그대로 보내는데도 고를 게 많아 보였다.
 * - 끼니는 시각으로 골라 둔 값을 「점심 · 12:34」 칩 하나로만 보여 주고, 눌러야 바꾼다.
 * - 시각은 찍은 시각으로 고정한다. 틀렸으면 올린 뒤 기록 편집에서 고친다.
 * - 받는 곳 이름이 보내기 버튼에 박혀 있다 — 엉뚱한 그룹에 보내는 실수를 줄인다.
 */
export function ShotEditor({
  slot,
  onSlotChange,
  capturedAt,
  caption,
  onCaptionChange,
  recipientSummary,
  onOpenRecipients,
  sendLabel,
  canSend,
  sending,
  onRetake,
  onSend,
}: {
  slot: MealSlotKey
  onSlotChange: (slot: MealSlotKey) => void
  /** 찍은 시각 'HH:mm' — 먹은 시각으로 쓴다 */
  capturedAt: string
  caption: string
  onCaptionChange: (v: string) => void
  /** 「받는 곳」 줄에 보일 요약 (예: "점심 원정대 외 1곳") */
  recipientSummary: string
  onOpenRecipients: () => void
  sendLabel: string
  canSend: boolean
  sending: boolean
  onRetake: () => void
  onSend: () => void
}) {
  const [slotOpen, setSlotOpen] = useState(false)

  return (
    <View className="gap-3 px-4">
      <View className="flex-row">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${slotLabel(slot)}, ${capturedAt}. 끼니 바꾸기`}
          onPress={() => setSlotOpen(true)}
          disabled={sending}
          className="h-chip flex-row items-center gap-1.5 rounded-full bg-white/15 px-4 active:opacity-70"
        >
          <Text className="font-bold text-white">
            {slotLabel(slot)} · {capturedAt}
          </Text>
          <Ionicons name="pencil" size={12} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>

      <TextInput
        value={caption}
        onChangeText={onCaptionChange}
        maxLength={100}
        editable={!sending}
        placeholder="한 줄 메모 (선택)"
        placeholderTextColor="rgba(255,255,255,0.5)"
        accessibilityLabel="한 줄 메모"
        returnKeyType="done"
        className="h-field rounded-full bg-white/15 px-4 text-sm text-white"
      />

      <View className="flex-row items-center gap-1.5 px-1">
        <Text className="text-xs text-white/60">받는 곳</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`받는 곳: ${recipientSummary}. 바꾸기`}
          onPress={onOpenRecipients}
          disabled={sending}
          hitSlop={10}
        >
          <Text className="text-xs font-bold text-white underline">{recipientSummary}</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 찍기"
          onPress={onRetake}
          disabled={sending}
          className="size-control items-center justify-center rounded-full bg-white/15 active:opacity-70"
        >
          <Ionicons name="refresh" size={20} color="#fff" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend || sending }}
          onPress={onSend}
          disabled={!canSend || sending}
          className={`h-control flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary px-5 active:opacity-80 ${
            canSend ? '' : 'opacity-40'
          }`}
        >
          {sending ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text className="font-bold text-primary-foreground">올리는 중…</Text>
            </>
          ) : (
            <Text numberOfLines={1} className="font-bold text-primary-foreground">
              {sendLabel}
            </Text>
          )}
        </Pressable>
      </View>

      <DarkSheet open={slotOpen} title="어느 끼니인가요?" onClose={() => setSlotOpen(false)}>
        <MealSlotChips
          value={slot}
          onChange={(next) => {
            onSlotChange(next)
            setSlotOpen(false)
          }}
        />
        <Text className="text-xs leading-5 text-white/55">
          먹은 시각은 사진을 찍은 시각({capturedAt})으로 기록해요. 다르면 올린 뒤 기록
          편집에서 고칠 수 있어요.
        </Text>
      </DarkSheet>
    </View>
  )
}
