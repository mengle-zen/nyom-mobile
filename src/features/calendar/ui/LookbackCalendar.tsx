import { useState } from 'react'
import { View } from 'react-native'
import { useAuth } from '@/features/auth'
import { localDayKey } from '@/entities/post/date-range'
import { useMyRecordedDays, useMyDayPosts } from '@/entities/post/queries'
import type { DayPost } from '@/entities/post/model'
import { isMonthAfter } from '../lib/month'
import {
  isFutureDayKey,
  monthViewOfDate,
  monthViewOfKey,
  shiftMonthView,
} from '../lib/view-month'
import { MonthCalendar } from './MonthCalendar'
import { DayTimeline } from './DayTimeline'

/**
 * 프로필 "돌아보기" 탭 — 내 기록(전 그룹 통합)을 월 캘린더로 회고.
 * 날짜를 고르면 그 날 끼니 타임라인이 아래에 인라인으로 뜬다.
 *
 * 상세 모달은 프로필 화면이 갖는다 — 그리드 탭과 같은 상세(편집·삭제 포함)를
 * 써야 하므로 여기서 따로 띄우지 않고 선택만 위로 올린다.
 *
 * 표시 월과 선택일은 절대 어긋나지 않게 둔다(`lib/view-month`): 기본값은 오늘의
 * 달이고, 넘침 칸(앞뒤 달)을 골라도 표시 월이 그 달로 따라간다. 표시 월이 선택일과
 * 다른 달이면 첫 화면이 텅 빈 달로 보여 "기록이 없나?"로 읽힌다.
 */
export function LookbackCalendar({
  onSelectPost,
}: {
  onSelectPost: (post: DayPost) => void
}) {
  const { user } = useAuth()
  const userId = user?.id

  const today = new Date()
  const todayKey = localDayKey(today)

  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [view, setView] = useState(() => monthViewOfDate(today))

  const { data: markedDays } = useMyRecordedDays(userId, view.year, view.month)
  const { data: dayPosts = [], isLoading: dayLoading } = useMyDayPosts(
    userId,
    selectedKey,
  )

  const canGoNext = isMonthAfter(
    today.getFullYear(),
    today.getMonth(),
    view.year,
    view.month,
  )

  const goPrev = () => setView((v) => shiftMonthView(v, -1))

  const goNext = () => {
    if (!canGoNext) return
    setView((v) => shiftMonthView(v, 1))
  }

  // 넘침 칸(앞뒤 달의 날짜)을 골랐으면 표시 월도 그 달로 옮긴다.
  const handleSelect = (key: string) => {
    setSelectedKey(key)
    setView(monthViewOfKey(key))
  }

  const isFutureKey = (key: string) => isFutureDayKey(key, today)

  return (
    <View className="gap-5">
      <MonthCalendar
        year={view.year}
        month={view.month}
        selectedKey={selectedKey}
        todayKey={todayKey}
        markedDays={markedDays ?? new Set()}
        canGoNext={canGoNext}
        isFutureKey={isFutureKey}
        onPrevMonth={goPrev}
        onNextMonth={goNext}
        onSelect={handleSelect}
      />
      <DayTimeline
        dayKey={selectedKey}
        isToday={selectedKey === todayKey}
        posts={dayPosts}
        loading={dayLoading}
        onSelect={onSelectPost}
      />
    </View>
  )
}
