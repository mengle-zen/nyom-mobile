import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { buildMonthGrid, monthLabel } from '../lib/month'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

type Props = {
  year: number
  /** 0-based */
  month: number
  /** 선택된 날짜 키('YYYY-MM-DD') */
  selectedKey: string
  /** 오늘 키 */
  todayKey: string
  /** 기록 있는 날짜 키 집합 (점 표시) */
  markedDays: Set<string>
  /** 다음 달로 이동 가능한지(미래 달 제한) */
  canGoNext: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onSelect: (key: string) => void
}

/**
 * 인라인 월 캘린더 (회고용).
 * 기록한 날을 점으로 보여주고, 빈 날은 강조하지 않는다(죄책감 방지).
 */
export function MonthCalendar({
  year,
  month,
  selectedKey,
  todayKey,
  markedDays,
  canGoNext,
  onPrevMonth,
  onNextMonth,
  onSelect,
}: Props) {
  const cells = buildMonthGrid(year, month)

  return (
    <View>
      {/* 월 이동 */}
      <View className="mb-3 flex-row items-center justify-between px-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          onPress={onPrevMonth}
          className="size-8 items-center justify-center rounded-full active:opacity-60"
        >
          <Ionicons name="chevron-back" size={20} color="#736756" />
        </Pressable>
        <Text className="text-base font-bold text-foreground">
          {monthLabel(year, month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          accessibilityState={{ disabled: !canGoNext }}
          disabled={!canGoNext}
          onPress={onNextMonth}
          className={`size-8 items-center justify-center rounded-full active:opacity-60 ${
            canGoNext ? '' : 'opacity-25'
          }`}
        >
          <Ionicons name="chevron-forward" size={20} color="#736756" />
        </Pressable>
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
      <View className="flex-row flex-wrap">
        {cells.map((cell) => {
          const marked = cell.inMonth && markedDays.has(cell.key)
          const isSelected = cell.key === selectedKey
          const isToday = cell.key === todayKey

          return (
            <Pressable
              key={cell.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${cell.key}${marked ? ' 기록 있음' : ''}`}
              onPress={() => onSelect(cell.key)}
              style={{ width: `${100 / 7}%` }}
              className="h-11 items-center justify-center gap-0.5 active:opacity-70"
            >
              <View
                className={`size-8 items-center justify-center rounded-full ${
                  isSelected
                    ? 'bg-primary'
                    : isToday
                      ? 'border border-primary-200'
                      : ''
                }`}
              >
                <Text
                  className={`text-sm ${
                    isSelected
                      ? 'font-bold text-primary-foreground'
                      : !cell.inMonth
                        ? 'text-neutral-300'
                        : isToday
                          ? 'font-bold text-primary'
                          : 'text-foreground'
                  }`}
                >
                  {cell.date.getDate()}
                </Text>
              </View>
              <View
                className={`size-1 rounded-full ${
                  marked ? (isSelected ? 'bg-primary' : 'bg-primary-300') : ''
                }`}
              />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
