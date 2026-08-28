import { useState } from 'react'
import { View } from 'react-native'
import { useAuth } from '@/features/auth'
import { localDayKey } from '@/entities/post/date-range'
import { useMyRecordedDays, useMyDayPosts } from '@/entities/post/queries'
import type { DayPost } from '@/entities/post/model'
import { isMonthAfter } from '../lib/month'
import { MonthCalendar } from './MonthCalendar'
import { DayTimeline } from './DayTimeline'

/**
 * 프로필 "돌아보기" 탭 — 내 기록(전 그룹 통합)을 월 캘린더로 회고.
 * 날짜를 고르면 그 날 끼니 타임라인이 아래에 인라인으로 뜬다.
 *
 * 상세 모달은 프로필 화면이 갖는다 — 그리드 탭과 같은 상세(편집·삭제 포함)를
 * 써야 하므로 여기서 따로 띄우지 않고 선택만 위로 올린다.
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

  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  })
  const [selectedKey, setSelectedKey] = useState(todayKey)

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

  const goPrev = () =>
    setView((v) => {
      const d = new Date(v.year, v.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  const goNext = () => {
    if (!canGoNext) return
    setView((v) => {
      const d = new Date(v.year, v.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  return (
    <View className="gap-5">
      <MonthCalendar
        year={view.year}
        month={view.month}
        selectedKey={selectedKey}
        todayKey={todayKey}
        markedDays={markedDays ?? new Set()}
        canGoNext={canGoNext}
        onPrevMonth={goPrev}
        onNextMonth={goNext}
        onSelect={setSelectedKey}
      />
      <DayTimeline posts={dayPosts} loading={dayLoading} onSelect={onSelectPost} />
    </View>
  )
}
