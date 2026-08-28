import { Pressable, Text, View } from 'react-native'
import { MEAL_SLOTS, type MealSlotKey } from '@/entities/post'

type Variant = 'onDark' | 'onLight'

/**
 * 끼니(아침·점심·저녁·야식) 선택 칩.
 * 업로드 1단계와 사후 편집이 같은 컨트롤을 쓴다 — 웹은 업로드에만 있어서
 * 잘못 잡힌 끼니를 영영 못 고쳤다(docs/UX_FINDINGS.md C항).
 */
export function MealSlotChips({
  value,
  onChange,
  disabled = false,
  variant = 'onDark',
}: {
  value: MealSlotKey
  onChange: (slot: MealSlotKey) => void
  disabled?: boolean
  variant?: Variant
}) {
  return (
    <View className={`flex-row gap-2 ${disabled ? 'opacity-50' : ''}`}>
      {MEAL_SLOTS.map((slot) => {
        const active = value === slot.key
        return (
          <Pressable
            key={slot.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={`끼니 ${slot.label}`}
            disabled={disabled}
            onPress={() => onChange(slot.key)}
            className={`flex-1 items-center rounded-full py-2 active:opacity-70 ${
              active
                ? 'bg-primary'
                : variant === 'onDark'
                  ? 'bg-white/15'
                  : 'bg-muted'
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                active
                  ? 'text-primary-foreground'
                  : variant === 'onDark'
                    ? 'text-white/80'
                    : 'text-muted-foreground'
              }`}
            >
              {slot.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
