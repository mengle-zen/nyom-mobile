import { Pressable, Text, View } from 'react-native'
import { canStep, stepTime, MINUTE_STEP } from '@/shared/lib/time-step'
import { haptic } from '@/shared/ui/press'

type Variant = 'onDark' | 'onLight'

const TONE: Record<
  Variant,
  { row: string; value: string; button: string; buttonText: string }
> = {
  onDark: {
    row: 'bg-white/10',
    value: 'text-white',
    button: 'bg-white/15 active:bg-white/25',
    buttonText: 'text-white',
  },
  onLight: {
    row: 'bg-muted',
    value: 'text-foreground',
    button: 'bg-neutral-0 active:bg-neutral-100',
    buttonText: 'text-foreground',
  },
}

/** 스텝 단위 — 시각 좌우로 대칭 배치된다. */
const STEPS = [
  { minutes: -60, text: '−1시간' },
  { minutes: -MINUTE_STEP, text: `−${MINUTE_STEP}분` },
  { minutes: MINUTE_STEP, text: `+${MINUTE_STEP}분` },
  { minutes: 60, text: '+1시간' },
] as const

/**
 * 'HH:mm' 시각 스테퍼.
 *
 * 웹의 `<input type="time">` 대체. RN에는 동등한 인라인 컨트롤이 없고, 기본값이
 * "지금"이라 실제 조작은 대부분 소폭 보정이다 — 휠 피커 모달보다 ± 버튼이 빠르다.
 * 값 계산은 전부 `lib/time-step`(순수·테스트됨)에 있고 여기서는 렌더만 한다.
 *
 * 예전 버전의 문제를 고쳤다:
 *  - `‹시` `−` `+` `시›` 네 버튼에 단위 라벨이 없어 무엇이 시간이고 무엇이 분인지
 *    눌러봐야 알 수 있었다. 이제 버튼에 `−1시간` `−5분`처럼 직접 쓴다.
 *  - `label=""`(편집 시트)일 때 시계 아이콘만 왼쪽에 고아로 남고 가운데가 비었다.
 *    라벨과 아이콘을 걷어내고 값을 가운데 두어 좌우 대칭으로 만들었다.
 *  - 스텝 버튼이 32pt로 iOS 권장 44pt에 못 미쳤다. 44pt로 올렸다.
 *  - 단위 배지가 9px이었다(iOS 권장 최소 11pt 미달).
 */
export function TimeStepper({
  value,
  max,
  onChange,
  disabled = false,
  variant = 'onDark',
}: {
  /** 'HH:mm' */
  value: string
  /** 고를 수 있는 최대 시각 'HH:mm' (now-only 원칙) */
  max: string
  onChange: (hhmm: string) => void
  disabled?: boolean
  variant?: Variant
}) {
  const tone = TONE[variant]

  return (
    <View
      className={`flex-row items-center justify-between gap-2 rounded-2xl px-2 py-2 ${tone.row} ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {STEPS.slice(0, 2).map((s) => (
        <StepButton
          key={s.minutes}
          text={s.text}
          tone={tone}
          disabled={disabled || !canStep(value, s.minutes, max)}
          onPress={() => onChange(stepTime(value, s.minutes, max))}
        />
      ))}

      <Text
        accessibilityLabel={`섭취 시각 ${value}`}
        className={`min-w-[68px] text-center text-xl font-bold ${tone.value}`}
      >
        {value}
      </Text>

      {STEPS.slice(2).map((s) => (
        <StepButton
          key={s.minutes}
          text={s.text}
          tone={tone}
          disabled={disabled || !canStep(value, s.minutes, max)}
          onPress={() => onChange(stepTime(value, s.minutes, max))}
        />
      ))}
    </View>
  )
}

function StepButton({
  text,
  tone,
  disabled,
  onPress,
}: {
  text: string
  tone: (typeof TONE)[Variant]
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.replace('−', '').replace('+', '') + (text.startsWith('−') ? ' 이전' : ' 이후')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        // 값이 한 칸 넘어가는 순간. 끝에 닿아 비활성이면 눌리지 않으므로 울리지 않는다.
        void haptic('select')
        onPress()
      }}
      // iOS 권장 최소 터치 타깃 44pt.
      className={`h-11 flex-1 items-center justify-center rounded-xl ${tone.button} ${
        disabled ? 'opacity-30' : ''
      }`}
    >
      <Text className={`text-[13px] font-bold ${tone.buttonText}`}>{text}</Text>
    </Pressable>
  )
}
