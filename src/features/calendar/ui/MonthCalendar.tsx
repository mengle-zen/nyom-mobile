import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PressableScale } from '@/shared/ui/press'
import { buildMonthGrid, monthLabel } from '../lib/month'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 7등분. 템플릿 문자열은 DimensionValue로 좁혀지지 않아 상수로 둔다. */
const CELL_WIDTH = '14.2857%' as const

const CHEVRON_ON = '#736756'
const CHEVRON_OFF = '#D9CCB7'

type Props = {
  year: number
  /** 0-based */
  month: number
  /** 선택된 날짜 키('YYYY-MM-DD') */
  selectedKey: string
  /** 오늘 키 */
  todayKey: string
  /** 기록 있는 날짜 키 집합 (점 · 배경 표시) */
  markedDays: Set<string>
  /** 다음 달로 이동 가능한지(미래 달 제한) */
  canGoNext: boolean
  /** 이 날짜 키가 오늘보다 미래인지 — 미래 날짜는 고를 수 없다 */
  isFutureKey: (key: string) => boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onSelect: (key: string) => void
}

/**
 * 인라인 월 캘린더 (회고용).
 *
 * 기록한 날은 옅은 배경 + 점으로 확실히 드러낸다 — 점만 있으면 빈 격자처럼 보여서
 * 기록이 있는 달인지 없는 달인지 한눈에 구분이 안 됐다. 반대로 기록 없는 날은
 * 강조하지 않는다(죄책감 방지).
 */
export function MonthCalendar({
  year,
  month,
  selectedKey,
  todayKey,
  markedDays,
  canGoNext,
  isFutureKey,
  onPrevMonth,
  onNextMonth,
  onSelect,
}: Props) {
  const cells = buildMonthGrid(year, month)

  return (
    <View>
      {/* 월 이동 */}
      <View className="mb-3 flex-row items-center justify-between px-1">
        <MonthArrow direction="prev" enabled onPress={onPrevMonth} />
        <Text className="text-base font-bold text-foreground">
          {monthLabel(year, month)}
        </Text>
        <MonthArrow direction="next" enabled={canGoNext} onPress={onNextMonth} />
      </View>

      {/* 요일 헤더 */}
      <View className="mb-1 flex-row">
        {WEEKDAYS.map((w, i) => (
          <View key={w} className="h-6 flex-1 items-center justify-center">
            <Text
              className={`text-xs font-medium ${
                i === 0 ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* 날짜 그리드 — 6주 42칸 고정(레이아웃 흔들림 방지) */}
      <MonthFade monthKey={`${year}-${month}`}>
        <View className="flex-row flex-wrap">
          {cells.map((cell) => {
            const marked = cell.inMonth && markedDays.has(cell.key)
            const isSelected = cell.key === selectedKey
            const isToday = cell.key === todayKey
            const future = isFutureKey(cell.key)

            return (
              <PressableScale
                key={cell.key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: future }}
                accessibilityLabel={`${cell.key}${marked ? ' 기록 있음' : ''}`}
                disabled={future}
                hapticKind="select"
                onPress={() => onSelect(cell.key)}
                style={{ width: CELL_WIDTH }}
                className="h-11 items-center justify-center gap-0.5"
              >
                <View
                  className={`size-8 items-center justify-center rounded-full ${
                    isSelected
                      ? 'bg-primary'
                      : marked
                        ? isToday
                          ? 'border border-primary-300 bg-primary-100'
                          : 'bg-primary-100'
                        : isToday
                          ? 'border border-primary-200'
                          : ''
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isSelected
                        ? 'font-bold text-primary-foreground'
                        : future || !cell.inMonth
                          ? 'text-neutral-300'
                          : isToday
                            ? 'font-bold text-primary'
                            : marked
                              ? 'font-semibold text-primary-700'
                              : 'text-foreground'
                    }`}
                  >
                    {cell.date.getDate()}
                  </Text>
                </View>
                {/* 점 자리는 항상 잡아 둔다 — 켜질 때 셀 높이가 흔들리지 않게 */}
                <View
                  className={`size-1.5 rounded-full ${
                    marked ? (isSelected ? 'bg-primary-300' : 'bg-primary') : ''
                  }`}
                />
              </PressableScale>
            )
          })}
        </View>
      </MonthFade>
    </View>
  )
}

/**
 * 월 이동 화살표. 비활성이면 눌러보지 않고도 알 수 있게 배경을 빼고 색을 죽인다 —
 * 이전엔 불투명도만 살짝 달라서 미래 달로 못 간다는 걸 눌러본 뒤에야 알 수 있었다.
 */
function MonthArrow({
  direction,
  enabled,
  onPress,
}: {
  direction: 'prev' | 'next'
  enabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'prev' ? '이전 달' : '다음 달'}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={8}
      className={`size-8 items-center justify-center rounded-full ${
        enabled ? 'bg-muted active:opacity-60' : ''
      }`}
    >
      <Ionicons
        name={direction === 'prev' ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={enabled ? CHEVRON_ON : CHEVRON_OFF}
      />
    </Pressable>
  )
}

/**
 * 월이 바뀔 때 격자를 짧게 페이드한다.
 * 숫자만 순간적으로 갈리면 달이 바뀐 건지 데이터가 바뀐 건지 알기 어렵다.
 * 방향까지 흉내내면 과해지므로 밝기만 — 네이티브 드라이버로 돌아 비용이 거의 없다.
 */
function MonthFade({
  monthKey,
  children,
}: {
  monthKey: string
  children: ReactNode
}) {
  const opacity = useState(() => new Animated.Value(1))[0]
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    opacity.setValue(0.35)
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [monthKey, opacity])

  return <Animated.View style={{ opacity }}>{children}</Animated.View>
}
