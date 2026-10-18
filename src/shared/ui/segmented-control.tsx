import { useCallback, useState } from 'react'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import {
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useSlideX } from './motion'
import { haptic, PressableScale } from './press'
import { CONTROL_SHADOW } from './shadow'

export type Segment<K extends string> = {
  key: K
  label: string
  icon?: keyof typeof Feather.glyphMap
}

type Props<K extends string> = {
  segments: Segment<K>[]
  value: K
  onChange: (key: K) => void
  /**
   * 컨테이너에 얹을 추가 스타일.
   *
   * ⚠️ 세그먼트는 `flex: 1`로 트랙을 나눠 갖는다. 그래서 여기에
   * `alignSelf: 'flex-start'`처럼 **콘텐츠에 맞춰 줄어드는 값**을 주면
   * 트랙 폭이 0이 되어 컨트롤이 얇은 조각으로 찌그러진다.
   * 폭을 줄이려면 `width`를 명시할 것.
   */
  style?: ViewStyle
}

/** 세그먼트 사이 간격(px). 인디케이터 위치 계산과 gap이 같은 값이어야 한다. */
const GAP = 4
/** 바깥 컨테이너 안쪽 여백(px). 인디케이터가 트랙 안에 딱 맞게 들어가려면 필요하다. */
const PAD = 4

/**
 * 미끄러지는 인디케이터가 달린 세그먼트 컨트롤.
 *
 * 세그먼트마다 배경을 켜고 끄면 선택이 "순간이동"해서 어디서 어디로 옮겼는지가
 * 남지 않는다. 알약 하나가 스프링으로 따라오면 두 세그먼트가 한 트랙 위의
 * 두 자리로 읽히고, 전환 자체가 조작에 대한 응답이 된다.
 *
 * 보드의 끼니 칩(`widgets/slot-chips`)이 같은 방식이라, 그룹·프로필의 탭도
 * 여기에 맞춰 앱 전체에서 세그먼트가 같은 움직임을 갖는다.
 */
export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  style,
}: Props<K>) {
  const [width, setWidth] = useState(0)
  const count = segments.length
  const activeIdx = Math.max(0, segments.findIndex((s) => s.key === value))
  const segW = count > 0 ? (width - GAP * (count - 1)) / count : 0

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }, [])

  return (
    <View
      accessibilityRole="tablist"
      className="rounded-xl bg-muted"
      style={[{ padding: PAD }, style]}
    >
      <View onLayout={onLayout} className="flex-row" style={{ gap: GAP }}>
        {segW > 0 && (
          <Indicator left={activeIdx * (segW + GAP)} width={segW} />
        )}

        {segments.map((seg) => {
          const active = seg.key === value
          return (
            <PressableScale
              key={seg.key}
              accessibilityRole="tab"
              accessibilityLabel={seg.label}
              accessibilityState={{ selected: active }}
              // 값이 한 칸 넘어가는 선택 — 이미 선택된 칸을 다시 누르면 아무 일도 없다.
              hapticKind={null}
              onPress={() => {
                if (active) return
                void haptic('select')
                onChange(seg.key)
              }}
              style={{ flex: 1 }}
              // 활성 배경은 아래에서 미끄러져 온 인디케이터가 맡는다.
              // 36 + 위아래 PAD 4 = 44(세그먼트 높이)
              className="h-9 flex-row items-center justify-center gap-1.5"
            >
              {seg.icon && (
                <Feather
                  name={seg.icon}
                  size={14}
                  color={active ? '#1F1B16' : '#A89A82'}
                />
              )}
              <Text
                className="text-[13px]"
                style={{
                  color: active ? '#1F1B16' : '#A89A82',
                  fontWeight: active ? '700' : '500',
                }}
              >
                {seg.label}
              </Text>
            </PressableScale>
          )
        })}
      </View>
    </View>
  )
}

/**
 * 선택된 세그먼트 뒤에 깔리는 흰 알약.
 *
 * translateX만 UI 스레드에서 움직인다. 폭은 레이아웃이 정해지는 시점에 확정되므로
 * 애니메이션하지 않는다.
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
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
          ...CONTROL_SHADOW,
        },
        slide,
      ]}
    />
  )
}
