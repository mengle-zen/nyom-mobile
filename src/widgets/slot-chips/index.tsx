import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import type { SlotProgress } from '@/entities/post'
import { useSlideX } from '@/shared/ui/motion'
import { PressableScale } from '@/shared/ui/press'

type Props = {
  slots: SlotProgress[]
  activeIdx: number
  onSelect: (idx: number) => void
}

/** 점을 너무 많이 찍으면 칩이 넘치므로 상한을 둔다(넘치면 +N로 대체). */
const MAX_DOTS = 4
/** 칩 사이 간격(px). 인디케이터 위치 계산과 gap 클래스가 같은 값을 써야 한다. */
const GAP = 6
/** 한 화면에 보이는 칩 수 = 기본 끼니 수. 태그 칩이 붙으면 가로로 넘친다. */
const VISIBLE = 4
/** 넘칠 때 다섯 번째 칩이 이만큼(칩 폭 대비) 비쳐 보여 "밀면 더 있다"를 알린다. */
const PEEK = 0.4

/**
 * 하루의 끼니를 **탭 가능한 세그먼트 칩**으로 상시 노출한다.
 *
 * 웹앱에서 슬롯 이동은 보이지 않는 좌우 30% 가장자리 탭이 유일했고, 상단 진행바는
 * 위치만 보여주고 눌리지 않았다. 그래서 "하루가 4끼니"라는 것도, 넘기는 방법도
 * 발견할 수 없었다(docs/UX_FINDINGS.md B항).
 *
 * 각 칩은 자기 슬롯의 올림 상태를 점으로 함께 보여준다 — 채워진 점 = 올린 멤버 수.
 * 덕분에 다른 끼니를 열어보지 않고도 "저녁은 아직 아무도 안 올렸네"를 알 수 있다.
 *
 * 선택 표시는 칩마다 배경을 켜고 끄는 대신 **하나의 인디케이터가 스프링으로 미끄러진다.**
 * 어디서 어디로 옮겼는지가 눈에 남아 세그먼트가 "한 덩어리"로 읽히고, 세로 스와이프로
 * 끼니를 넘길 때도 같은 움직임이 재생돼 두 조작이 같은 것을 만진다는 게 드러난다.
 *
 * 기본 끼니 넷 뒤에 그날 올라온 태그 페이지가 이어진다(2026-10 시안 A안). 태그가 없는
 * 대부분의 날엔 예전과 똑같은 네 칸 세그먼트이고, 태그가 있으면 칩을 조금 좁혀 다섯 번째
 * 칩이 끝에 비쳐 보이게 한 뒤 가로로 밀어 본다(꽉 찬 네 칸이면 뒤에 뭐가 있는지 모른다). 태그 칩은 점선 테두리로 기본 끼니와 구분하고,
 * 선택된 칩이 화면 밖이면 가운데로 끌어온다(세로 스와이프로 넘어갔을 때).
 */
export function SlotChips({ slots, activeIdx, onSelect }: Props) {
  const [width, setWidth] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const overflow = slots.length > VISIBLE
  const shown = overflow ? VISIBLE + PEEK : VISIBLE
  const chipW = width > 0 ? (width - GAP * Math.floor(shown)) / shown : 0
  const left = activeIdx * (chipW + GAP)

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }, [])

  useEffect(() => {
    if (chipW === 0 || !overflow) return
    scrollRef.current?.scrollTo({ x: Math.max(0, left - (width - chipW) / 2), animated: true })
  }, [left, chipW, width, overflow])

  return (
    <View className="px-4 pb-2 pt-1">
      <View onLayout={onLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          scrollEnabled={overflow}
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerClassName="flex-row gap-1.5"
        >
          {chipW > 0 && <Indicator left={left} width={chipW} />}

          {chipW > 0 &&
            slots.map((slot, idx) => {
              const active = idx === activeIdx
              return (
                <PressableScale
                  key={slot.key}
                  onPress={() => onSelect(idx)}
                  // 끼니를 바꾸는 건 "보는 대상을 갈아끼우는" 조작이라 짧은 선택 햅틱이
                  // 맞다. 화면 이동에는 붙이지 않는다 — 남용하면 진동이 배경 소음이 된다.
                  hapticKind="select"
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${slot.isTag ? '태그 ' : ''}${slot.label} ${slot.filled}/${slot.total} 올림`}
                  style={{ width: chipW }}
                  // 활성 칩의 배경은 아래에서 미끄러져 온 인디케이터가 맡는다.
                  className={`min-h-chip items-center justify-center gap-1 rounded-full px-2 py-1.5 ${
                    active ? '' : slot.isTag ? 'border border-dashed border-white/30 bg-white/10' : 'bg-white/10'
                  }`}
                >
                  <Text
                    numberOfLines={1}
                    className={`text-[13px] font-bold ${active ? 'text-primary-foreground' : 'text-white/70'}`}
                  >
                    {slot.label}
                  </Text>
                  <SlotDots filled={slot.filled} total={slot.total} active={active} />
                </PressableScale>
              )
            })}
        </ScrollView>
      </View>
    </View>
  )
}

/**
 * 선택된 칩 뒤에 깔리는 알약. translateX만 UI 스레드에서 움직인다.
 *
 * 튕기지 않는다 — 네 칩이 좁게 붙어 있어 오버슈트가 옆 칩까지 넘어간 것처럼 보이고,
 * 탭에는 손가락의 운동량이 없어 튕길 이유도 없다.
 */
function Indicator({ left, width }: { left: number; width: number }) {
  const x = useSlideX(left)
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width,
          borderRadius: 999,
          backgroundColor: '#FF7A2E',
        },
        slide,
      ]}
    />
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
        className={`text-xs font-bold ${active ? 'text-primary-foreground' : 'text-white/60'}`}
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
