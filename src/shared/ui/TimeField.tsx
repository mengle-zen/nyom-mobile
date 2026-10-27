import { useRef, useState, type Ref } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { timeFromParts, type TimeInput } from '@/shared/lib/time-input'
import { haptic } from '@/shared/ui/press'

const ERRORS: Record<Exclude<TimeInput, { ok: true }>['reason'], string> = {
  incomplete: '시와 분을 모두 적어 주세요',
  hour: '시는 0~23 사이로 적어 주세요',
  minute: '분은 0~59 사이로 적어 주세요',
  future: '아직 오지 않은 시각이에요',
}

/** 기록 편집(밝은 시트)과 올리기(어두운 화면) 두 곳에서 쓴다. */
const TONE = {
  onLight: {
    label: 'text-muted-foreground',
    digits: 'text-foreground',
    focus: 'bg-muted',
    error: 'text-destructive',
    on: { icon: '#C24F0E', text: 'text-primary-700' },
    off: { icon: '#D9CCB7', text: 'text-neutral-300' },
  },
  onDark: {
    label: 'text-white/65',
    digits: 'text-white',
    focus: 'bg-white/10',
    error: 'text-primary-300',
    on: { icon: '#FFA56A', text: 'text-primary-300' },
    off: { icon: 'rgba(255,255,255,0.3)', text: 'text-white/30' },
  },
} as const
type Tone = (typeof TONE)[keyof typeof TONE]

const split = (hhmm: string) => {
  const [h = '', m = ''] = hhmm.split(':')
  return { h, m }
}

/**
 * 「섭취 시각」 한 줄 — 시·분 숫자를 바로 눌러 고친다(2026-10 시안 A′안).
 *
 * 예전 ±5분·±1시간 스테퍼는 12:30처럼 멀리 옮기려면 여러 번 눌러야 했다.
 * 시 칸에 두 자리를 치면 분 칸으로 넘어가고, 칸을 누르면 숫자 전체가 선택돼
 * 바로 덮어쓴다. 오른쪽 「초기화」는 원래 시각으로, 「현재」는 지금 시각으로.
 *
 * 다 칠 때까지는 값이 비거나 범위를 넘을 수 있으므로 그동안은 `onChange(null)`로
 * "아직 쓸 수 없는 값"을 알린다 — 부모가 저장을 막는다.
 */
export function TimeField({
  label,
  value,
  original,
  max,
  current,
  onChange,
  disabled = false,
  variant = 'onLight',
}: {
  label: string
  /** 'HH:mm' — 마지막으로 유효했던 값 */
  value: string
  /** 「초기화」가 되돌릴 시각 'HH:mm' */
  original: string
  /** 고를 수 있는 가장 늦은 시각 'HH:mm' (now-only 원칙) */
  max: string
  /** 「현재」가 맞출 시각. null이면 버튼을 숨긴다(지난날 기록엔 의미가 없다). */
  current: string | null
  /** 유효하면 'HH:mm', 아직 쓸 수 없는 입력이면 null */
  onChange: (hhmm: string | null) => void
  disabled?: boolean
  variant?: keyof typeof TONE
}) {
  const tone = TONE[variant]
  const [draft, setDraft] = useState(() => split(value))
  const [error, setError] = useState('')
  const minuteRef = useRef<TextInput>(null)

  const explain = (result: TimeInput) =>
    result.ok ? '' : result.reason === 'future' ? `${ERRORS.future} (지금 ${max})` : ERRORS[result.reason]

  /**
   * 범위 오류(시 24, 분 61, 지금 이후)는 치는 즉시 알린다 — 숫자 키패드엔 「완료」 키가
   * 없어 칸을 떠나지 않는 일이 흔하고, 그러면 저장이 왜 꺼졌는지 모른다.
   * 덜 친 상태(incomplete)는 아직 치는 중일 수 있으니 칸을 떠날 때만 알린다.
   */
  const update = (next: { h: string; m: string }) => {
    setDraft(next)
    const result = timeFromParts(next.h, next.m, max)
    setError(!result.ok && result.reason !== 'incomplete' ? explain(result) : '')
    onChange(result.ok ? result.value : null)
  }

  /** 칸을 떠날 때 한 자리를 채우고, 쓸 수 없는 값이면 이유를 보여 준다. */
  const settle = () => {
    const result = timeFromParts(draft.h, draft.m, max)
    if (result.ok) setDraft(split(result.value))
    setError(explain(result))
  }

  const jump = (hhmm: string) => {
    void haptic('select')
    update(split(hhmm))
  }

  const shown = timeFromParts(draft.h, draft.m, max)
  const showing = shown.ok ? shown.value : null

  return (
    <View className={disabled ? 'opacity-50' : ''}>
      <View className="min-h-row flex-row items-center gap-1">
        <Text className={`flex-1 text-sm font-medium ${tone.label}`}>{label}</Text>

        <Digits
          value={draft.h}
          label={`${label} 시, 0~23`}
          tone={tone}
          disabled={disabled}
          onChangeText={(t) => {
            const h = t.replace(/\D/g, '').slice(0, 2)
            update({ ...draft, h })
            if (h.length === 2) minuteRef.current?.focus()
          }}
          onBlur={settle}
          returnKeyType="next"
          onSubmitEditing={() => minuteRef.current?.focus()}
        />
        <Text className={`text-xl font-extrabold ${tone.label}`}>:</Text>
        <Digits
          ref={minuteRef}
          value={draft.m}
          label={`${label} 분, 0~59`}
          tone={tone}
          disabled={disabled}
          onChangeText={(t) => update({ ...draft, m: t.replace(/\D/g, '').slice(0, 2) })}
          onBlur={settle}
          returnKeyType="done"
        />

        <TextButton
          icon="refresh"
          text="초기화"
          a11y={`처음 시각 ${original}으로 되돌리기`}
          tone={tone}
          disabled={disabled || showing === original}
          onPress={() => jump(original)}
        />
        {current !== null && (
          <TextButton
            icon="time-outline"
            text="현재"
            a11y={`현재 시각 ${current}으로 맞추기`}
            tone={tone}
            disabled={disabled || showing === current}
            onPress={() => jump(current)}
          />
        )}
      </View>

      {error ? (
        <Text accessibilityLiveRegion="polite" className={`text-xs ${tone.error}`}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

function Digits({
  ref,
  value,
  label,
  tone,
  disabled,
  onChangeText,
  onBlur,
  returnKeyType,
  onSubmitEditing,
}: {
  ref?: Ref<TextInput>
  value: string
  label: string
  tone: Tone
  disabled: boolean
  onChangeText: (t: string) => void
  onBlur: () => void
  returnKeyType: 'next' | 'done'
  onSubmitEditing?: () => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      ref={ref}
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        onBlur()
      }}
      onSubmitEditing={onSubmitEditing}
      editable={!disabled}
      keyboardType="number-pad"
      returnKeyType={returnKeyType}
      maxLength={2}
      // 누르면 두 자리가 통째로 선택돼 바로 덮어쓴다
      selectTextOnFocus
      accessibilityLabel={label}
      className={`h-11 w-11 rounded-lg text-center text-[22px] font-extrabold tabular-nums ${tone.digits} ${
        focused ? tone.focus : ''
      }`}
    />
  )
}

function TextButton({
  icon,
  text,
  a11y,
  tone,
  disabled,
  onPress,
}: {
  icon: 'refresh' | 'time-outline'
  text: string
  a11y: string
  tone: Tone
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      className="h-11 flex-row items-center gap-0.5 rounded-lg px-1.5 active:opacity-60"
    >
      <Ionicons name={icon} size={13} color={disabled ? tone.off.icon : tone.on.icon} />
      <Text className={`text-[13px] font-bold ${disabled ? tone.off.text : tone.on.text}`}>
        {text}
      </Text>
    </Pressable>
  )
}
