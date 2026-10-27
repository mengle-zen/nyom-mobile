import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MealTagPicker } from '@/entities/post/ui/MealTagPicker'
import { TimeField } from '@/shared/ui/TimeField'

/**
 * 미리보기 아래 — 시각 · 태그 · 메모 · 받는 곳 · 보내기. 이 화면 하나에서 올리기가 끝난다.
 *
 * - 끼니는 고르지 않는다(2026-10-27 시간 띠 개편). 찍은 시각이 기본이고, 시·분 두 칸으로
 *   바로 고친다 — 방 화면에서 사진은 이 시각 자리에 놓이고 사진 위에 새겨진다.
 * - 태그(야식 등)는 선택이다.
 * - 받는 곳 이름이 보내기 버튼에 박혀 있다 — 엉뚱한 그룹에 보내는 실수를 줄인다.
 */
export function ShotEditor({
  tag,
  onTagChange,
  recentTags,
  time,
  originalTime,
  maxTime,
  onTimeChange,
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
  tag: string | null
  onTagChange: (tag: string | null) => void
  /** 내가 최근 쓴 태그 */
  recentTags: string[]
  /** 먹은 시각 'HH:mm' — 마지막으로 유효했던 값 */
  time: string
  /** 찍은 시각 'HH:mm' — 「초기화」가 되돌릴 값. 사진이 바뀌면 입력 칸도 새로 그린다. */
  originalTime: string
  /** 지금 'HH:mm' — 이보다 늦게는 못 고른다 */
  maxTime: string
  /** 유효하면 'HH:mm', 아직 쓸 수 없는 입력이면 null */
  onTimeChange: (hhmm: string | null) => void
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
  return (
    <View className="gap-3 px-4">
      <TimeField
        key={originalTime}
        label="먹은 시각"
        value={time}
        original={originalTime}
        max={maxTime}
        current={maxTime}
        onChange={onTimeChange}
        disabled={sending}
        variant="onDark"
      />
      <MealTagPicker value={tag} onChange={onTagChange} recentTags={recentTags} disabled={sending} />

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

    </View>
  )
}
