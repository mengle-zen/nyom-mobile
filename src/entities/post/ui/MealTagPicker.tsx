import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { MEAL_TAG_MAX, parseMealTag } from '@/entities/post'
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
 * 선택 태그(야식·디저트·술 …) 붙이기·고치기·빼기. 올리기와 사후 편집이 같은 컨트롤을 쓴다.
 *
 * 2026-10-27 시간 띠 개편으로 끼니 칸(아침·점심·저녁·간식)이 없어져 태그만 남았다.
 * 평소엔 칩 하나(`＋ 태그` 또는 `야식 ✎`)이고, 누르면 그 자리가 입력 칸으로 바뀌며
 * 아래에 내가 최근 쓴 태그가 칩으로 나온다(2026-10 시안 A안의 입력 방식 그대로).
 */
export function MealTagPicker({
  value,
  onChange,
  recentTags = [],
  disabled = false,
  variant = 'onDark',
}: {
  value: string | null
  onChange: (tag: string | null) => void
  /** 내가 최근 쓴 태그 — 입력 중에 칩으로 보여 준다 */
  recentTags?: string[]
  disabled?: boolean
  variant?: Variant
}) {
  const tone = TONE[variant]
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const close = () => {
    setTyping(false)
    setError('')
  }

  const commit = (tag: string | null) => {
    close()
    if (tag === value) return
    void haptic('select')
    onChange(tag)
  }

  const apply = (raw: string) => {
    const result = parseMealTag(raw)
    if (!result.ok) {
      setError(result.reason === 'empty' ? '이름을 적어 주세요' : `${MEAL_TAG_MAX}자까지 쓸 수 있어요`)
      return
    }
    commit(result.tag)
  }

  if (!typing) {
    return (
      <View className={`flex-row ${disabled ? 'opacity-50' : ''}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `태그 ${value}, 고쳐 쓰기` : '태그 붙이기 — 야식처럼 원하는 이름으로'}
          disabled={disabled}
          onPress={() => {
            setDraft(value ?? '')
            setError('')
            setTyping(true)
          }}
          className={`h-chip max-w-full flex-row items-center justify-center gap-1 rounded-full px-4 active:opacity-70 ${
            value ? 'bg-primary' : tone.idle
          }`}
        >
          {value ? (
            <>
              <Text numberOfLines={1} className="shrink text-sm font-bold text-primary-foreground">
                {value}
              </Text>
              <Ionicons name="pencil" size={11} color="rgba(255,255,255,0.8)" />
            </>
          ) : (
            <>
              <Ionicons name="add" size={16} color={tone.icon} />
              <Text className={`text-sm font-bold ${tone.idleText}`}>태그</Text>
            </>
          )}
        </Pressable>
      </View>
    )
  }

  const length = [...draft.trim()].length
  const recent = recentTags.filter((t) => t !== value)
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
        <View className="ml-auto flex-row">
          {value !== null && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`태그 ${value} 빼기`}
              onPress={() => commit(null)}
              hitSlop={8}
              className="h-8 justify-center px-2 active:opacity-70"
            >
              <Text className={`text-xs font-bold ${tone.sub}`}>태그 빼기</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="태그 입력 그만두기"
            onPress={close}
            hitSlop={8}
            className="h-8 justify-center px-2 active:opacity-70"
          >
            <Text className={`text-xs ${tone.sub}`}>취소</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
