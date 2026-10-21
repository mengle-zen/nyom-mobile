import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  MEAL_SLOTS,
  MEAL_TAG_MAX,
  parseMealTag,
  sameMeal,
  slotMeal,
  type Meal,
} from '@/entities/post'
import { haptic } from '@/shared/ui/press'

type Variant = 'onDark' | 'onLight'

const TONE = {
  onDark: {
    idle: 'bg-white/15',
    idleText: 'text-white/80',
    field: 'border-white/20 bg-white/10 text-white',
    placeholder: 'rgba(255,255,255,0.4)',
    sub: 'text-white/55',
    icon: 'rgba(255,255,255,0.8)',
  },
  onLight: {
    idle: 'bg-muted',
    idleText: 'text-muted-foreground',
    field: 'border-border bg-card text-foreground',
    placeholder: '#A89A82',
    sub: 'text-muted-foreground',
    icon: '#736756',
  },
} as const

/**
 * 끼니 선택 — 기본 끼니 칩 넷(아침·점심·저녁·간식) + 사용자 태그.
 * 업로드와 사후 편집이 같은 컨트롤을 쓴다 — 웹은 업로드에만 있어서
 * 잘못 잡힌 끼니를 영영 못 고쳤다(docs/UX_FINDINGS.md C항).
 *
 * 태그(2026-10 시안 A안): 줄 끝 「＋」를 누르면 칩 줄이 그 자리에서 입력 칸으로 바뀌고,
 * 아래에 내가 최근 쓴 태그가 칩으로 나온다. 붙인 태그는 「＋」 자리에 칩으로 남고,
 * 누르면 고쳐 쓸 수 있다. 태그를 떼려면 기본 끼니 칩을 고르면 된다.
 * 시트를 한 겹 더 띄우지 않는 건, 대부분 기본 끼니를 그대로 쓰고 태그는 가끔이라서다.
 */
export function MealSlotChips({
  value,
  onChange,
  recentTags = [],
  disabled = false,
  variant = 'onDark',
}: {
  value: Meal
  onChange: (meal: Meal) => void
  /** 내가 최근 쓴 태그 — 입력 중에 칩으로 보여 준다 */
  recentTags?: string[]
  disabled?: boolean
  variant?: Variant
}) {
  const tone = TONE[variant]
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const pick = (meal: Meal) => {
    setTyping(false)
    setError('')
    if (sameMeal(meal, value)) return
    void haptic('select')
    onChange(meal)
  }

  const startTyping = () => {
    setDraft(value.tag ?? '')
    setError('')
    setTyping(true)
  }

  const apply = (raw: string) => {
    const result = parseMealTag(raw)
    if (!result.ok) {
      setError(result.reason === 'empty' ? '이름을 적어 주세요' : `${MEAL_TAG_MAX}자까지 쓸 수 있어요`)
      return
    }
    pick(result.meal)
  }

  if (typing) {
    const length = [...draft.trim()].length
    const recent = recentTags.filter((t) => t !== value.tag)
    return (
      <View className={`gap-2 ${disabled ? 'opacity-50' : ''}`}>
        <View className="flex-row items-center gap-2">
          <TextInput
            value={draft}
            onChangeText={(v) => {
              setDraft(v)
              setError('')
            }}
            onSubmitEditing={() => apply(draft)}
            autoFocus
            maxLength={MEAL_TAG_MAX}
            editable={!disabled}
            returnKeyType="done"
            placeholder="예: 야식, 디저트, 술"
            placeholderTextColor={tone.placeholder}
            accessibilityLabel={`태그 이름, ${MEAL_TAG_MAX}자까지`}
            className={`h-chip flex-1 rounded-full border px-4 text-sm ${tone.field}`}
          />
          <Text className={`w-9 text-right text-xs tabular-nums ${tone.sub}`}>
            {length}/{MEAL_TAG_MAX}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="태그 붙이기"
            accessibilityState={{ disabled: disabled || length === 0 }}
            disabled={disabled || length === 0}
            onPress={() => apply(draft)}
            className={`h-chip items-center justify-center rounded-full bg-primary px-4 active:opacity-80 ${
              length === 0 ? 'opacity-40' : ''
            }`}
          >
            <Text className="text-sm font-bold text-primary-foreground">붙이기</Text>
          </Pressable>
        </View>

        {error ? (
          <Text accessibilityLiveRegion="polite" className="text-xs text-primary-400">
            {error}
          </Text>
        ) : null}

        <View className="flex-row flex-wrap items-center gap-1.5">
          {recent.length > 0 && <Text className={`text-xs ${tone.sub}`}>최근</Text>}
          {recent.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={`최근 태그 ${tag} 붙이기`}
              disabled={disabled}
              onPress={() => apply(tag)}
              className={`h-8 items-center justify-center rounded-full px-3 active:opacity-70 ${tone.idle}`}
            >
              <Text className={`text-xs font-bold ${tone.idleText}`}>{tag}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="태그 입력 그만두기"
            onPress={() => {
              setTyping(false)
              setError('')
            }}
            hitSlop={8}
            className="ml-auto h-8 justify-center px-1 active:opacity-70"
          >
            <Text className={`text-xs ${tone.sub}`}>취소</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View className={`flex-row gap-2 ${disabled ? 'opacity-50' : ''}`}>
      {MEAL_SLOTS.map((slot) => {
        const active = value.slot === slot.key
        return (
          <Pressable
            key={slot.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={`끼니 ${slot.label}`}
            disabled={disabled}
            onPress={() => pick(slotMeal(slot.key))}
            className={`h-chip flex-1 items-center justify-center rounded-full active:opacity-70 ${
              active ? 'bg-primary' : tone.idle
            }`}
          >
            <Text
              className={`text-sm font-bold ${active ? 'text-primary-foreground' : tone.idleText}`}
            >
              {slot.label}
            </Text>
          </Pressable>
        )
      })}

      {value.tag !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: true, disabled }}
          accessibilityLabel={`태그 ${value.tag}, 고쳐 쓰기`}
          disabled={disabled}
          onPress={startTyping}
          className="h-chip max-w-[30%] flex-row items-center justify-center gap-1 rounded-full bg-primary px-3 active:opacity-70"
        >
          <Text numberOfLines={1} className="shrink text-sm font-bold text-primary-foreground">
            {value.tag}
          </Text>
          <Ionicons name="pencil" size={11} color="rgba(255,255,255,0.8)" />
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="태그 붙이기 — 야식처럼 다른 이름으로"
          disabled={disabled}
          onPress={startTyping}
          className={`h-chip w-11 items-center justify-center rounded-full active:opacity-70 ${tone.idle}`}
        >
          <Ionicons name="add" size={18} color={tone.icon} />
        </Pressable>
      )}
    </View>
  )
}
