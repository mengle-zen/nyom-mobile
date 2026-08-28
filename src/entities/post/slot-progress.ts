import { MEAL_SLOTS, buildSlotBoard, type MealSlotKey } from './board'

/** 상단 끼니 칩 하나가 그리는 데이터 — 라벨 + "몇 명이 올렸나". */
export type SlotProgress = {
  key: MealSlotKey
  label: string
  /** 그 슬롯에 기록을 올린 멤버 수 */
  filled: number
  /** 그룹 멤버 수 */
  total: number
}

type MemberLike = { user_id: string }
type PostLike = {
  user_id: string
  meal_slot: string | null
  created_at: string
  recorded_at?: string
}

/**
 * 하루 4끼니 각각의 올림 상태를 한 번에 계산한다.
 *
 * 웹앱은 슬롯 이동 컨트롤이 없어(보이지 않는 가장자리 탭이 전부였다) 하루가 4끼니라는
 * 사실 자체를 알 수 없었다(docs/UX_FINDINGS.md B항). 여기서는 끼니 칩을 상단에 상시
 * 노출하고, 각 칩이 자기 슬롯의 올림 상태를 점으로 함께 보여준다 — 진행바가 하던
 * "지금 몇 번째 끼니인가"와 "누가 올렸나"를 칩 하나가 대신한다.
 *
 * 멤버당 1칸으로 세므로(`buildSlotBoard`와 같은 규칙) 한 멤버가 같은 끼니에 두 번
 * 올려도 filled는 1만 올라간다.
 */
export function slotProgress<M extends MemberLike, P extends PostLike>(
  members: M[],
  posts: P[],
): SlotProgress[] {
  return MEAL_SLOTS.map(({ key, label }) => ({
    key,
    label,
    filled: buildSlotBoard(members, posts, key).filledCount,
    total: members.length,
  }))
}

/** 슬롯 인덱스를 0..MEAL_SLOTS.length-1 안으로 자른다(칩·스와이프 공용). */
export function clampSlotIdx(idx: number): number {
  if (idx < 0) return 0
  const last = MEAL_SLOTS.length - 1
  return idx > last ? last : idx
}
