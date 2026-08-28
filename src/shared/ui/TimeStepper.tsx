import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { canStep, stepTime, MINUTE_STEP } from '@/shared/lib/time-step'

type Variant = 'onDark' | 'onLight'

const TONE: Record<
  Variant,
  { row: string; label: string; value: string; button: string; icon: string }
> = {
  onDark: {
    row: 'bg-white/15',
    label: 'text-white/80',
    value: 'text-white',
    button: 'bg-white/15',
    icon: '#fff',
  },
  onLight: {
    row: 'bg-muted',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    button: 'bg-neutral-0',
    icon: '#3A3329',
  },
}

/**
 * 'HH:mm' 시각 스테퍼.
 *
 * 웹의 `<input type="time">` 대체. RN에는 동등한 인라인 컨트롤이 없고, 기본값이
 * "지금"이라 실제 조작은 대부분 소폭 보정이다 — 휠 피커 모달보다 ± 버튼이 빠르다.
 * 값 계산은 전부 `lib/time-step`(순수·테스트됨)에 있고 여기서는 렌더만 한다.
 */
export function TimeStepper({
  value,
  max,
  onChange,
  disabled = false,
  label = '섭취 시각',
  variant = 'onDark',
}: {
  /** 'HH:mm' */
  value: string
  /** 고를 수 있는 최대 시각 'HH:mm' (now-only 원칙) */
  max: string
  onChange: (hhmm: string) => void
  disabled?: boolean
  label?: string
  variant?: Variant
}) {
  const tone = TONE[variant]

  const step = (delta: number) => () => onChange(stepTime(value, delta, max))

  return (
    <View
      className={`flex-row items-center gap-2 rounded-full px-4 py-2 ${tone.row} ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <Ionicons name="time-outline" size={16} color={tone.icon} />
      <Text className={`text-sm font-medium ${tone.label}`}>{label}</Text>

      <View className="ml-auto flex-row items-center gap-1">
        <StepButton
          label="1시간 이전"
          icon="chevron-back"
          tone={tone}
          disabled={disabled || !canStep(value, -60, max)}
          onPress={step(-60)}
          badge="시"
        />
        <StepButton
          label={`${MINUTE_STEP}분 이전`}
          icon="remove"
          tone={tone}
          disabled={disabled || !canStep(value, -MINUTE_STEP, max)}
          onPress={step(-MINUTE_STEP)}
        />

        <Text
          accessibilityLabel={`섭취 시각 ${value}`}
          className={`min-w-[52px] text-center text-base font-bold ${tone.value}`}
        >
          {value}
        </Text>

        <StepButton
          label={`${MINUTE_STEP}분 이후`}
          icon="add"
          tone={tone}
          disabled={disabled || !canStep(value, MINUTE_STEP, max)}
          onPress={step(MINUTE_STEP)}
        />
        <StepButton
          label="1시간 이후"
          icon="chevron-forward"
          tone={tone}
          disabled={disabled || !canStep(value, 60, max)}
          onPress={step(60)}
          badge="시"
        />
      </View>
    </View>
  )
}

function StepButton({
  label,
  icon,
  tone,
  disabled,
  onPress,
  badge,
}: {
  label: string
  icon: 'chevron-back' | 'chevron-forward' | 'add' | 'remove'
  tone: (typeof TONE)[Variant]
  disabled: boolean
  onPress: () => void
  badge?: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      className={`size-8 flex-row items-center justify-center rounded-full ${tone.button} ${
        disabled ? 'opacity-30' : 'active:opacity-60'
      }`}
    >
      <Ionicons name={icon} size={14} color={tone.icon} />
      {badge && (
        <Text className={`text-[9px] font-bold ${tone.value}`}>{badge}</Text>
      )}
    </Pressable>
  )
}
