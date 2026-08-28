import { Pressable, Text, View } from 'react-native'
import type { SlotProgress } from '@/entities/post'

type Props = {
  slots: SlotProgress[]
  activeIdx: number
  onSelect: (idx: number) => void
}

/** 점을 너무 많이 찍으면 칩이 넘치므로 상한을 둔다(넘치면 +N로 대체). */
const MAX_DOTS = 4

/**
 * 하루의 네 끼니를 **탭 가능한 세그먼트 칩**으로 상시 노출한다.
 *
 * 웹앱에서 슬롯 이동은 보이지 않는 좌우 30% 가장자리 탭이 유일했고, 상단 진행바는
 * 위치만 보여주고 눌리지 않았다. 그래서 "하루가 4끼니"라는 것도, 넘기는 방법도
 * 발견할 수 없었다(docs/UX_FINDINGS.md B항).
 *
 * 각 칩은 자기 슬롯의 올림 상태를 점으로 함께 보여준다 — 채워진 점 = 올린 멤버 수.
 * 덕분에 다른 끼니를 열어보지 않고도 "저녁은 아직 아무도 안 올렸네"를 알 수 있다.
 */
export function SlotChips({ slots, activeIdx, onSelect }: Props) {
  return (
    <View
      className="flex-row gap-1.5 px-4 pb-2 pt-1"
      accessibilityRole="tablist"
    >
      {slots.map((slot, idx) => {
        const active = idx === activeIdx
        return (
          <Pressable
            key={slot.key}
            onPress={() => onSelect(idx)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${slot.label} ${slot.filled}/${slot.total} 올림`}
            className={`flex-1 items-center gap-1 rounded-full px-2 py-1.5 active:opacity-80 ${
              active ? 'bg-primary' : 'bg-white/10'
            }`}
          >
            <Text
              className={`text-[13px] font-bold ${active ? 'text-primary-foreground' : 'text-white/70'}`}
            >
              {slot.label}
            </Text>
            <SlotDots filled={slot.filled} total={slot.total} active={active} />
          </Pressable>
        )
      })}
    </View>
  )
}

function SlotDots({
  filled,
  total,
  active,
}: {
  filled: number
  total: number
  active: boolean
}) {
  // 멤버가 많은 그룹에서는 점 대신 숫자로 접는다.
  if (total > MAX_DOTS) {
    return (
      <Text
        className={`text-[10px] font-bold ${active ? 'text-primary-foreground' : 'text-white/45'}`}
      >
        {filled}/{total}
      </Text>
    )
  }

  return (
    <View className="h-1.5 flex-row items-center gap-1">
      {Array.from({ length: total }, (_, i) => {
        const on = i < filled
        return (
          <View
            key={i}
            className={`size-1.5 rounded-full ${
              active
                ? on
                  ? 'bg-primary-foreground'
                  : 'bg-primary-foreground/35'
                : on
                  ? 'bg-primary'
                  : 'bg-white/20'
            }`}
          />
        )
      })}
    </View>
  )
}
