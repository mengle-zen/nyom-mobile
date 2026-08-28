import { describe, it, expect } from 'vitest'
import {
  dayRangeFromOffset, dateLabel,
  localDayKey, dateFromOffset, offsetFromDate,
  hhmmFromDate, recordedAtFromTime,
  recordedAtOnSameDay, maxTimeForRecordedDay,
} from './date-range'

describe('dayRangeFromOffset', () => {
  it('offset 0 = 기준일의 자정~다음날 자정', () => {
    const now = new Date('2026-06-09T15:30:00')
    const { start, end } = dayRangeFromOffset(0, now)
    expect(start.toISOString()).toBe(new Date('2026-06-09T00:00:00').toISOString())
    expect(end.toISOString()).toBe(new Date('2026-06-10T00:00:00').toISOString())
  })

  it('offset 1 = 어제 범위', () => {
    const now = new Date('2026-06-09T15:30:00')
    const { start } = dayRangeFromOffset(1, now)
    expect(start.toISOString()).toBe(new Date('2026-06-08T00:00:00').toISOString())
  })
})

describe('dateLabel', () => {
  it('offset 0 → 오늘', () => {
    expect(dateLabel(0, new Date('2026-06-09T10:00:00'))).toBe('오늘')
  })
  it('offset 1 → 어제', () => {
    expect(dateLabel(1, new Date('2026-06-09T10:00:00'))).toBe('어제')
  })
  it('offset 2+ → M월 D일 (요일)', () => {
    expect(dateLabel(2, new Date('2026-06-09T10:00:00'))).toBe('6월 7일 (일)')
  })
})

describe('localDayKey', () => {
  it('로컬 날짜를 YYYY-MM-DD로 (월·일 0패딩)', () => {
    expect(localDayKey(new Date(2026, 5, 9))).toBe('2026-06-09')
    expect(localDayKey(new Date(2026, 11, 25))).toBe('2026-12-25')
  })
})

describe('dateFromOffset ↔ offsetFromDate', () => {
  const now = new Date('2026-06-09T15:30:00')

  it('offset 0 = 오늘 자정', () => {
    expect(localDayKey(dateFromOffset(0, now))).toBe('2026-06-09')
  })
  it('offset 2 = 이틀 전', () => {
    expect(localDayKey(dateFromOffset(2, now))).toBe('2026-06-07')
  })
  it('offsetFromDate는 dateFromOffset의 역', () => {
    expect(offsetFromDate(dateFromOffset(5, now), now)).toBe(5)
  })
  it('오늘=0, 어제=1', () => {
    expect(offsetFromDate(new Date('2026-06-09T08:00:00'), now)).toBe(0)
    expect(offsetFromDate(new Date('2026-06-08T23:00:00'), now)).toBe(1)
  })
  it('미래는 음수', () => {
    expect(offsetFromDate(new Date('2026-06-10T01:00:00'), now)).toBe(-1)
  })
})

describe('hhmmFromDate', () => {
  it('HH:mm 0패딩', () => {
    expect(hhmmFromDate(new Date(2026, 5, 9, 9, 5))).toBe('09:05')
    expect(hhmmFromDate(new Date(2026, 5, 9, 18, 30))).toBe('18:30')
  })
})

describe('recordedAtFromTime', () => {
  const now = new Date('2026-06-09T15:30:00')

  it('오늘 날짜 + 선택 시각', () => {
    const iso = recordedAtFromTime(now, '12:30')
    const d = new Date(iso)
    expect(hhmmFromDate(d)).toBe('12:30')
    expect(localDayKey(d)).toBe('2026-06-09')
  })
  it('미래 시각은 현재로 클램프', () => {
    // now 15:30인데 18:00 선택 → 15:30으로 클램프
    expect(recordedAtFromTime(now, '18:00')).toBe(now.toISOString())
  })
  it('현재 시각 정각 선택은 그대로', () => {
    expect(recordedAtFromTime(now, '15:30')).toBe(
      new Date('2026-06-09T15:30:00').toISOString(),
    )
  })
})

describe('recordedAtOnSameDay', () => {
  const now = new Date('2026-06-09T15:30:00')

  it('과거 기록의 시:분만 바꾸고 날짜는 유지', () => {
    const iso = recordedAtOnSameDay('2026-06-05T21:00:00', '08:15', now)
    const d = new Date(iso)
    expect(hhmmFromDate(d)).toBe('08:15')
    expect(localDayKey(d)).toBe('2026-06-05')
  })

  it('과거 기록은 그 날의 늦은 시각도 허용 (이미 지난 시각이므로)', () => {
    const iso = recordedAtOnSameDay('2026-06-05T09:00:00', '23:59', now)
    expect(localDayKey(new Date(iso))).toBe('2026-06-05')
    expect(hhmmFromDate(new Date(iso))).toBe('23:59')
  })

  it('오늘 기록에 미래 시각을 넣으면 현재로 클램프', () => {
    expect(recordedAtOnSameDay('2026-06-09T10:00:00', '18:00', now)).toBe(
      now.toISOString(),
    )
  })

  it('초·밀리초는 0으로 정규화', () => {
    const d = new Date(recordedAtOnSameDay('2026-06-05T21:33:44.555', '08:15', now))
    expect(d.getSeconds()).toBe(0)
    expect(d.getMilliseconds()).toBe(0)
  })

  it('잘못된 HH:mm이면 원래 시각을 그대로', () => {
    const original = '2026-06-05T21:00:00'
    expect(recordedAtOnSameDay(original, '', now)).toBe(
      new Date(original).toISOString(),
    )
  })
})

describe('maxTimeForRecordedDay', () => {
  const now = new Date('2026-06-09T15:30:00')

  it('기록일이 오늘이면 지금까지', () => {
    expect(maxTimeForRecordedDay('2026-06-09T09:00:00', now)).toBe('15:30')
  })
  it('기록일이 과거면 그 날 끝까지', () => {
    expect(maxTimeForRecordedDay('2026-06-05T09:00:00', now)).toBe('23:59')
  })
})
