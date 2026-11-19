import { localDayKey } from '@/entities/post/date-range'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 프로필 그리드의 한 칸 — 하루치 내 기록(2026-11-19 시안, https://claude.ai/artifact/TBEigKqCkn4zRTTYLcEf3z). */
export type DayGroup<P> = {
  /** 'YYYY-MM-DD' (먹은 날, 로컬) */
  key: string
  /** 먹은 시각순 — 첫 장이 칸의 대표 사진 */
  posts: P[]
}

/** 먹은 날로 묶는다. 최근 날부터, 하루 안은 이른 끼니부터. */
export function groupByDay<P extends { recorded_at: string }>(posts: P[]): DayGroup<P>[] {
  const byDay = new Map<string, P[]>()
  for (const p of posts) {
    const key = localDayKey(new Date(p.recorded_at))
    const list = byDay.get(key)
    if (list) list.push(p)
    else byDay.set(key, [p])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => ({
      key,
      posts: list.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
    }))
}

/** 칸 아래 띠 — '11.19 (수)' */
export function shortDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${m}.${String(d).padStart(2, '0')} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

/** 상세 위쪽 — '11월 19일 (수)' */
export function longDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}
