import { hhmmFromDate } from './date-range'

export type MealSlotKey = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/**
 * 기본 끼니. 야식·디저트·술처럼 다른 이름이 필요하면 사용자가 태그로 붙인다
 * (2026-10-21 — 예전엔 네 번째가 야식이었다. 기존 야식 기록은 '야식' 태그로 옮겼다).
 */
export const MEAL_SLOTS: readonly { key: MealSlotKey; label: string }[] = [
  { key: 'breakfast', label: '아침' },
  { key: 'lunch', label: '점심' },
  { key: 'dinner', label: '저녁' },
  { key: 'snack', label: '간식' },
] as const

/** 사용자 태그 최대 글자 수. DB `posts_meal_tag_check`와 같아야 한다. */
export const MEAL_TAG_MAX = 10

/**
 * 기록 하나의 끼니 — 기본 끼니 또는 사용자 태그 중 정확히 하나.
 * DB도 `posts_meal_one_check`로 둘이 함께 들어가지 못하게 막는다.
 */
export type Meal = { slot: MealSlotKey; tag: null } | { slot: null; tag: string }

export function slotMeal(slot: MealSlotKey): Meal {
  return { slot, tag: null }
}

/** posts 행의 두 칸에서 끼니를 읽는다. 둘 다 비었거나 모르는 값이면 null. */
export function mealOf(row: { meal_slot: string | null; meal_tag?: string | null }): Meal | null {
  if (row.meal_tag) return { slot: null, tag: row.meal_tag }
  const slot = MEAL_SLOTS.find((s) => s.key === row.meal_slot)?.key
  return slot ? slotMeal(slot) : null
}

export function slotLabel(key: MealSlotKey): string {
  return MEAL_SLOTS.find((s) => s.key === key)?.label ?? ''
}

export function mealLabel(meal: Meal): string {
  return meal.slot ? slotLabel(meal.slot) : meal.tag
}

/**
 * 끼니를 문자열 하나로 — 보드 페이지 식별·라우트 파라미터용.
 * 기본 끼니는 키 그대로('lunch'), 태그는 'tag:야식'. 태그가 'lunch'여도 겹치지 않는다.
 */
export function mealKey(meal: Meal): string {
  return meal.slot ?? `tag:${meal.tag}`
}

/** `mealKey`의 역. 모르는 키·규칙에 안 맞는 태그면 null. */
export function mealFromKey(key: string | null | undefined): Meal | null {
  if (!key) return null
  if (key.startsWith('tag:')) {
    const parsed = parseMealTag(key.slice(4))
    return parsed.ok ? parsed.meal : null
  }
  const slot = MEAL_SLOTS.find((s) => s.key === key)?.key
  return slot ? slotMeal(slot) : null
}

export function sameMeal(a: Meal | null, b: Meal | null): boolean {
  if (!a || !b) return a === b
  return a.slot === b.slot && a.tag === b.tag
}

export type MealTagInput =
  | { ok: true; meal: Meal }
  | { ok: false; reason: 'empty' | 'too_long' }

/**
 * 사용자가 입력한 태그 이름을 끼니로 바꾼다.
 * - 앞뒤 공백을 지우고 안쪽 연속 공백은 하나로 접는다.
 * - 기본 끼니와 같은 이름('간식')이면 그 끼니로 — 같은 끼니가 보드에 두 페이지로
 *   갈라지지 않게. DB도 그런 태그를 막는다.
 * - 글자 수는 코드 포인트로 센다(Postgres `char_length`와 같은 기준).
 */
export function parseMealTag(raw: string): MealTagInput {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) return { ok: false, reason: 'empty' }
  if ([...name].length > MEAL_TAG_MAX) return { ok: false, reason: 'too_long' }
  const slot = MEAL_SLOTS.find((s) => s.label === name)?.key
  return { ok: true, meal: slot ? slotMeal(slot) : { slot: null, tag: name } }
}

/**
 * 끼니 + 섭취 시각 한 줄 라벨 — '점심 · 12:34'.
 * 프로필 그리드 오버레이 칩처럼 좁은 자리에 쓰므로 짧게 유지한다.
 * 끼니가 없으면 시각만, 시각을 못 읽으면 끼니만(둘 다 없으면 빈 문자열).
 */
export function mealTimeLabel(
  recordedAt: string | null | undefined,
  meal: Meal | null | undefined,
): string {
  const label = meal ? mealLabel(meal) : ''
  const date = recordedAt ? new Date(recordedAt) : null
  if (!date || Number.isNaN(date.getTime())) return label

  const time = hhmmFromDate(date)
  return label ? `${label} · ${time}` : time
}

/**
 * 현재 시각으로 기본 끼니를 추정한다(업로드 칩 기본 선택용).
 *
 * 하루 경계를 자정이 아니라 생활 리듬에 맞춘다 — 새벽 0~4시에 먹는 건
 * 아침이 아니라 전날에서 이어지는 밤참이다. 웹앱 초기 구현은 `hour < 11`을
 * 통째로 아침으로 잡아 새벽 1시 라면이 "아침"으로 기록됐고, 편집 화면에
 * 끼니 항목이 없어 고칠 수도 없었다(docs/UX_FINDINGS.md C항).
 * 밤(21시~)과 새벽은 간식으로 잡는다. 야식이라 부르고 싶으면 태그로 붙인다 —
 * 기본값이 태그를 대신 골라 주지는 않는다(사용자마다 이름이 다르다).
 */
export function defaultSlotForHour(hour: number): MealSlotKey {
  if (hour < 5) return 'snack'
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

type MemberLike = { user_id: string }
type PostLike = {
  user_id: string
  meal_slot: string | null
  meal_tag?: string | null
  created_at: string
  recorded_at?: string
}

export type Tile<M extends MemberLike, P extends PostLike> = {
  member: M
  post: P | null
  extraCount: number   // 같은 멤버·끼니 추가 게시물 수
}

export type SlotBoard<M extends MemberLike, P extends PostLike> = {
  meal: Meal
  tiles: Tile<M, P>[]
  filledCount: number
}

const postTime = (p: PostLike) => p.recorded_at ?? p.created_at

/** 멤버 목록과 그날 게시물에서 특정 끼니의 타일 배열을 만든다. */
export function buildSlotBoard<M extends MemberLike, P extends PostLike>(
  members: M[],
  posts: P[],
  meal: Meal,
): SlotBoard<M, P> {
  const inMeal = posts.filter((p) => sameMeal(mealOf(p), meal))

  const tiles = members.map<Tile<M, P>>((member) => {
    const mine = inMeal
      .filter((p) => p.user_id === member.user_id)
      .sort((a, b) => postTime(b).localeCompare(postTime(a)))
    return {
      member,
      post: mine[0] ?? null,
      extraCount: Math.max(0, mine.length - 1),
    }
  })

  return {
    meal,
    tiles,
    filledCount: tiles.filter((t) => t.post !== null).length,
  }
}

/** 보드의 한 페이지 — 기본 끼니 넷 + 그날 올라온 태그들. */
export type BoardPage = { key: string; label: string; meal: Meal }

/**
 * 그날 보드의 페이지 목록. 기본 끼니 넷은 늘 있고, 그 뒤에 누군가 태그로 올린
 * 끼니가 처음 올라온 시각 순으로 붙는다(아무도 안 쓴 태그는 페이지가 없다).
 */
export function boardPages(posts: PostLike[]): BoardPage[] {
  const firstAt = new Map<string, string>()
  for (const p of posts) {
    if (!p.meal_tag) continue
    const at = postTime(p)
    const seen = firstAt.get(p.meal_tag)
    if (seen === undefined || at < seen) firstAt.set(p.meal_tag, at)
  }
  const tags = [...firstAt.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([tag]) => ({ slot: null, tag }) as Meal)

  return [...MEAL_SLOTS.map((s) => slotMeal(s.key)), ...tags].map((meal) => ({
    key: mealKey(meal),
    label: mealLabel(meal),
    meal,
  }))
}
