import { hhmmFromDate } from './date-range'

/** 사용자 태그 최대 글자 수. DB `posts_meal_tag_check`와 같아야 한다. */
export const MEAL_TAG_MAX = 10

export type MealTagInput = { ok: true; tag: string } | { ok: false; reason: 'empty' | 'too_long' }

/**
 * 사용자가 입력한 태그 이름 정리 — 앞뒤 공백 제거, 안쪽 연속 공백은 하나로.
 * 글자 수는 코드 포인트로 센다(Postgres `char_length`와 같은 기준).
 * 2026-10-27 시간 띠 개편으로 끼니 칸이 없어져 '점심'도 그냥 태그다.
 */
export function parseMealTag(raw: string): MealTagInput {
  const tag = raw.trim().replace(/\s+/g, ' ')
  if (!tag) return { ok: false, reason: 'empty' }
  if ([...tag].length > MEAL_TAG_MAX) return { ok: false, reason: 'too_long' }
  return { ok: true, tag }
}

/** 「야식 · 23:40」 / 「23:40」 — 그리드 오버레이·상세 머리처럼 좁은 자리용. */
export function postTimeLabel(recordedAt: string | null | undefined, tag: string | null | undefined): string {
  const date = recordedAt ? new Date(recordedAt) : null
  const time = date && !Number.isNaN(date.getTime()) ? hhmmFromDate(date) : ''
  if (tag && time) return `${tag} · ${time}`
  return tag || time
}
