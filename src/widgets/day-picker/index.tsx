import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { localDayKey } from '@/entities/post'
import { buildMonthGrid, monthLabel, isMonthAfter } from '@/features/calendar'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

type Props = {
  open: boolean
  onClose: () => void
  /** 현재 보고 있는 날짜 */
  selected: Date
  /** 날짜를 고르면 호출(닫는 것은 호출 측에서) */
  onSelect: (date: Date) => void
  /** 기록이 있는 날짜 키('YYYY-MM-DD') 집합 — 점 표시 */
  markedDays?: Set<string>
  /** 이 날짜보다 미래는 비활성(=오늘) */
  maxDate: Date
  /** 이 날짜보다 과거는 비활성(=보드가 다루는 최근 N일의 끝) */
  minDate: Date
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * 날짜 선택 달력. 기록 있는 날에 점, 미래는 비활성, 「오늘로 이동」.
 *
 * 닫혀 있는 동안에는 마운트하지 않고 `selected`가 바뀌면 key로 리마운트한다 —
 * "보고 있는 달"을 effect 없이 마운트 시 파생 초기값으로만 정하기 위해서다(웹과 동일).
 */
export function DayPicker({ open, onClose, ...panel }: Props) {
  return (
    <Modal
      visible={open}
      onRequestClose={onClose}
      // iOS pageSheet은 아래로 쓸어내려 닫을 수 있다. 그 경로로 닫히면 onRequestClose가
      // 오지 않아 open 상태만 true로 남고 다시 열리지 않는다 — onDismiss로 상태를 맞춘다.
      onDismiss={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      {open && (
        <DayPickerPanel key={panel.selected.getTime()} onClose={onClose} {...panel} />
      )}
    </Modal>
  )
}

function DayPickerPanel({
  onClose,
  selected,
  onSelect,
  markedDays,
  maxDate,
  minDate,
}: Omit<Props, 'open'>) {
  const insets = useSafeAreaInsets()
  const [view, setView] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  )

  const today = new Date()
  const year = view.getFullYear()
  const month = view.getMonth()
  const cells = buildMonthGrid(year, month)

  const maxTime = startOfDay(maxDate)
  const minTime = startOfDay(minDate)
  const selectedKey = localDayKey(selected)
  const todayKey = localDayKey(today)
  const nextBlocked = isMonthAfter(year, month + 1, maxDate.getFullYear(), maxDate.getMonth())

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }}
    >
      <View className="flex-row items-center px-4 pb-4">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          hitSlop={8}
          className="size-icon items-center justify-center rounded-full bg-card active:opacity-70"
        >
          <Ionicons name="chevron-down" size={20} color="#1F1B16" />
        </Pressable>
        <Text className="flex-1 pr-9 text-center text-xl font-bold text-foreground">
          날짜 선택
        </Text>
      </View>

      <View className="mt-1 flex-row items-center justify-center gap-3">
        <Pressable
          onPress={() => setView(new Date(year, month - 1, 1))}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          hitSlop={8}
          className="size-8 items-center justify-center active:opacity-60"
        >
          <Ionicons name="chevron-back" size={20} color="#736756" />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{monthLabel(year, month)}</Text>
        <Pressable
          onPress={() => setView(new Date(year, month + 1, 1))}
          disabled={nextBlocked}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          accessibilityState={{ disabled: nextBlocked }}
          hitSlop={8}
          className="size-8 items-center justify-center active:opacity-60"
          style={{ opacity: nextBlocked ? 0.25 : 1 }}
        >
          <Ionicons name="chevron-forward" size={20} color="#736756" />
        </Pressable>
      </View>

      <View className="mt-6 flex-row px-4">
        {WEEKDAYS.map((w, i) => (
          <View key={w} className="items-center" style={{ width: `${100 / 7}%` }}>
            <Text
              className={`text-xs font-medium ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {w}
            </Text>
          </View>
        ))}
      </View>

      <View className="mt-2 flex-row flex-wrap px-4">
        {cells.map((cell) => {
          const time = cell.date.getTime()
          const disabled = !cell.inMonth || time > maxTime || time < minTime
          const isSelected = cell.key === selectedKey
          const isToday = cell.key === todayKey
          const marked = markedDays?.has(cell.key) ?? false

          return (
            <View key={cell.key} style={{ width: `${100 / 7}%` }} className="items-center py-1">
              <Pressable
                onPress={() => onSelect(cell.date)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected: isSelected }}
                accessibilityLabel={`${cell.date.getMonth() + 1}월 ${cell.date.getDate()}일${marked ? ', 기록 있음' : ''}`}
                className="h-12 items-center justify-center gap-1 active:opacity-70"
                style={{ opacity: disabled ? 0.25 : 1 }}
              >
                <View
                  className={`size-[34px] items-center justify-center rounded-full ${
                    isSelected ? 'bg-primary' : ''
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isSelected
                        ? 'font-bold text-primary-foreground'
                        : isToday
                          ? 'font-bold text-primary'
                          : 'text-foreground'
                    }`}
                  >
                    {cell.date.getDate()}
                  </Text>
                </View>
                <View
                  className={`size-[5px] rounded-full ${
                    marked ? (isSelected ? 'bg-primary' : 'bg-primary/70') : 'bg-transparent'
                  }`}
                />
              </Pressable>
            </View>
          )
        })}
      </View>

      <View className="mt-6 px-6">
        <Pressable
          onPress={() => onSelect(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}
          accessibilityRole="button"
          className="h-[52px] items-center justify-center rounded-full bg-primary active:opacity-85"
        >
          <Text className="text-sm font-bold text-primary-foreground">오늘로 이동</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center gap-1.5 px-6">
        <View className="size-1.5 rounded-full bg-primary/70" />
        <Text className="text-xs font-medium text-muted-foreground">
          점이 있는 날엔 기록이 있어요 · 최근 2주까지 볼 수 있어요
        </Text>
      </View>
    </View>
  )
}
