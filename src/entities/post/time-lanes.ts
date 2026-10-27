/**
 * 방 화면 시간 띠의 배치 계산(2026-10-27 설계 ②).
 * - 사진이 있는 구간은 30분 = 사진 한 변.
 * - 사진 한 장은 그 시각부터 30분을 차지하고, 모든 띠의 자리를 합친 구간 사이가
 *   1시간 넘게 비면 접힌 줄 하나로 바꾼다.
 * - 같은 띠에서 겹치면 아래로 민다. 순서는 정확, 간격은 대략(각인 시각은 늘 정확).
 */
export const LANE_GAP = 4
export const FOLD_HEIGHT = 24
const SLOT_MIN = 30
const FOLD_AFTER_MIN = 60

export type LanePost = { id: string; at: string }
export type LaneItem = { postId: string; lane: number; y: number }
export type LaneMark =
  | { kind: 'tick'; y: number; label: string }
  | { kind: 'fold'; y: number; from: string; to: string }
export type LanesLayout = { height: number; items: LaneItem[]; marks: LaneMark[]; nowY: number | null }

const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes()
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

type Entry = { id: string; lane: number; min: number }
type Window = { start: number; end: number; entries: Entry[] }

export function timeLanesLayout(input: {
  lanes: LanePost[][]
  photo: number
  now: Date | null
}): LanesLayout {
  const { photo } = input
  const scale = photo / SLOT_MIN
  const entries: Entry[] = input.lanes
    .flatMap((posts, lane) => posts.map((p) => ({ id: p.id, lane, min: minuteOf(new Date(p.at)) })))
    .sort((a, b) => a.min - b.min)
  if (entries.length === 0) return { height: 0, items: [], marks: [], nowY: null }

  const windows: Window[] = []
  for (const e of entries) {
    const last = windows[windows.length - 1]
    if (last && e.min - last.end <= FOLD_AFTER_MIN) {
      last.entries.push(e)
      last.end = Math.max(last.end, e.min + SLOT_MIN)
    } else {
      windows.push({ start: e.min, end: e.min + SLOT_MIN, entries: [e] })
    }
  }

  const items: LaneItem[] = []
  const marks: LaneMark[] = []
  const laneBottom = new Map<number, number>()
  const tops: number[] = []
  let top = 0
  let bottom = 0

  windows.forEach((w, wi) => {
    if (wi > 0) {
      const foldY = bottom + LANE_GAP
      marks.push({ kind: 'fold', y: foldY, from: hhmm(windows[wi - 1].end), to: hhmm(w.start) })
      top = foldY + FOLD_HEIGHT + LANE_GAP
    }
    tops.push(top)
    let windowBottom = top + (w.end - w.start) * scale
    for (const e of w.entries) {
      const base = top + (e.min - w.start) * scale
      const prev = laneBottom.get(e.lane)
      const y = prev === undefined ? base : Math.max(base, prev + LANE_GAP)
      items.push({ postId: e.id, lane: e.lane, y })
      laneBottom.set(e.lane, y + photo)
      windowBottom = Math.max(windowBottom, y + photo)
    }
    for (let h = Math.floor(w.start / 60) + 1; h * 60 <= w.end; h++) {
      marks.push({ kind: 'tick', y: top + (h * 60 - w.start) * scale, label: hhmm(h * 60) })
    }
    bottom = windowBottom
  })

  let nowY: number | null = null
  if (input.now) {
    const n = minuteOf(input.now)
    const last = windows[windows.length - 1]
    const inside = windows.findIndex((w) => n >= w.start && n <= w.end)
    if (inside >= 0) {
      nowY = tops[inside] + (n - windows[inside].start) * scale
    } else if (n > last.end) {
      if (n - last.end > FOLD_AFTER_MIN) {
        const foldY = bottom + LANE_GAP
        marks.push({ kind: 'fold', y: foldY, from: hhmm(last.end), to: hhmm(n) })
        nowY = foldY + FOLD_HEIGHT + LANE_GAP
      } else {
        nowY = tops[tops.length - 1] + (n - last.start) * scale
      }
    } else if (n < windows[0].start) {
      nowY = 0
    } else {
      const fold = marks.find(
        (m): m is Extract<LaneMark, { kind: 'fold' }> => m.kind === 'fold' && hhmm(n) >= m.from && hhmm(n) <= m.to,
      )
      nowY = fold ? fold.y + FOLD_HEIGHT / 2 : null
    }
  }

  return { height: Math.max(bottom, (nowY ?? 0) + 2), items, marks, nowY }
}

/** 띠 순서 — 나를 맨 앞으로, 나머지는 받은 순서(멤버 조회가 이미 들어온 순). */
export function laneMembers<M extends { user_id: string }>(members: M[], me: string): M[] {
  return [...members.filter((m) => m.user_id === me), ...members.filter((m) => m.user_id !== me)]
}

/** 그 사람의 그날 기록, 시각순 — 띠와 상세 캐러셀이 같이 쓴다. */
export function postsByMember<P extends { user_id: string; recorded_at: string }>(posts: P[], userId: string): P[] {
  return posts.filter((p) => p.user_id === userId).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
}
