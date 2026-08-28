import { hhmmFromDate } from './date-range'

export type MealSlotKey = 'breakfast' | 'lunch' | 'dinner' | 'late_snack'

export const MEAL_SLOTS: ReadonlyArray<{ key: MealSlotKey; label: string }> = [
  { key: 'breakfast', label: '아침' },
  { key: 'lunch', label: '점심' },
  { key: 'dinner', label: '저녁' },
  { key: 'late_snack', label: '야식' },
] as const

export function slotLabel(key: MealSlotKey): string {
  return MEAL_SLOTS.find((s) => s.key === key)?.label ?? ''
}

/**
 * 끼니 + 섭취 시각 한 줄 라벨 — '점심 · 12:34'.
 * 프로필 그리드 오버레이 칩처럼 좁은 자리에 쓰므로 짧게 유지한다.
 * 끼니가 없으면 시각만, 시각을 못 읽으면 끼니만(둘 다 없으면 빈 문자열).
 */
export function mealTimeLabel(
  recordedAt: string | null | undefined,
  mealSlot: MealSlotKey | null | undefined,
): string {
  const slot = mealSlot ? slotLabel(mealSlot) : ''
  const date = recordedAt ? new Date(recordedAt) : null
  if (!date || Number.isNaN(date.getTime())) return slot

  const time = hhmmFromDate(date)
  return slot ? `${slot} · ${time}` : time
}

/**
 * 현재 시각으로 기본 끼니를 추정한다(업로드 칩 기본 선택용).
 *
 * 하루 경계를 자정이 아니라 생활 리듬에 맞춘다 — 새벽 0~4시에 먹는 건
 * 아침이 아니라 전날에서 이어지는 야식이다. 웹앱 초기 구현은 `hour < 11`을
 * 통째로 아침으로 잡아 새벽 1시 라면이 "아침"으로 기록됐고, 편집 화면에
 * 끼니 항목이 없어 고칠 수도 없었다(docs/UX_FINDINGS.md C항).
 * 야식은 PRD가 명시적으로 담으려는 대표 사례(컵라면·야식)라 오분류 비용이 크다.
 */
export function defaultSlotForHour(hour: number): MealSlotKey {
  if (hour < 5) return 'late_snack'
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'late_snack'
}

type MemberLike = { user_id: string }
type PostLike = {
  user_id: string
  meal_slot: string | null
  created_at: string
  recorded_at?: string
}

export type Tile<M extends MemberLike, P extends PostLike> = {
  member: M
  post: P | null
  extraCount: number   // 같은 멤버·슬롯 추가 게시물 수
}

export type SlotBoard<M extends MemberLike, P extends PostLike> = {
  slot: MealSlotKey
  tiles: Tile<M, P>[]
  filledCount: number
}

/** 멤버 목록과 그날 게시물에서 특정 슬롯의 타일 배열을 만든다. */
export function buildSlotBoard<M extends MemberLike, P extends PostLike>(
  members: M[],
  posts: P[],
  slot: MealSlotKey,
): SlotBoard<M, P> {
  const inSlot = posts.filter((p) => p.meal_slot === slot)

  const tiles = members.map<Tile<M, P>>((member) => {
    const key = (p: P) => p.recorded_at ?? p.created_at
    const mine = inSlot
      .filter((p) => p.user_id === member.user_id)
      .sort((a, b) => key(b).localeCompare(key(a)))
    return {
      member,
      post: mine[0] ?? null,
      extraCount: Math.max(0, mine.length - 1),
    }
  })

  return {
    slot,
    tiles,
    filledCount: tiles.filter((t) => t.post !== null).length,
  }
}
