/**
 * 게시물 사후 편집의 순수 로직.
 * 한 촬영(batch)은 그룹마다 posts 행이 있지만 메모·시각은 batch 전체가 공유하므로
 * 편집 단위도 batch다. 여기서는 "무엇이 바뀌었나"만 계산한다(네트워크 없음).
 */

/**
 * 편집 폼의 상태. recordedTime은 'HH:mm'(로컬).
 * tag는 선택 — 없으면 null(2026-10-27 시간 띠 개편으로 끼니 칸이 없어졌다).
 */
export type PostBatchDraft = {
  groupIds: string[]
  caption: string
  recordedTime: string
  tag: string | null
}

export type GroupSelectionDiff = {
  /** 새로 공유할 그룹 — 같은 batch_id로 행이 insert된다 */
  added: string[]
  /** 공유를 끊을 그룹 — 그 그룹의 행이 delete된다 */
  removed: string[]
  /**
   * 캐시 무효화 대상 — 추가·제거·유지 그룹 전부.
   * 제거된 그룹의 보드도 갱신해야 하므로 합집합이어야 한다.
   */
  affected: string[]
}

/** 그룹 선택의 변경분. 순서는 입력 순서를 따르고 중복은 접는다. */
export function diffGroupSelection(
  before: string[],
  after: string[],
): GroupSelectionDiff {
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  return {
    added: [...afterSet].filter((id) => !beforeSet.has(id)),
    removed: [...beforeSet].filter((id) => !afterSet.has(id)),
    affected: [...new Set([...before, ...after])],
  }
}

/** 두 그룹 목록이 같은 집합인지(순서·중복 무시). */
export function sameGroupSelection(a: string[], b: string[]): boolean {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size !== setB.size) return false
  for (const id of setA) if (!setB.has(id)) return false
  return true
}

/**
 * 저장할 변경이 있는지 — 없으면 저장 버튼을 비활성화한다.
 * 메모는 앞뒤 공백을 무시한다(서버도 btrim 후 저장하므로 공백만 바뀐 건 변경이 아니다).
 */
export function hasPostBatchChanges(
  before: PostBatchDraft,
  after: PostBatchDraft,
): boolean {
  if (before.caption.trim() !== after.caption.trim()) return true
  if (before.recordedTime !== after.recordedTime) return true
  if (before.tag !== after.tag) return true
  return !sameGroupSelection(before.groupIds, after.groupIds)
}

/**
 * RPC에 보낼 태그. 안 바뀌면 null(서버에서 "변경 없음"), 지우면 ''(서버가 끼니·태그를 비운다,
 * 20261027000000_time_lanes.sql). 태그를 건드리지 않은 편집이 옛 기록의 끼니 값을 덮지 않게 구분한다.
 */
export function tagChange(before: string | null, after: string | null): string | null {
  if (before === after) return null
  return after ?? ''
}

/** 사후 편집 RPC가 올리는 에러 → 사용자 문구. */
export function postEditErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '')
  if (message.includes('NOT_GROUP_MEMBER')) return '그룹 멤버가 아니라 올릴 수 없어요'
  if (message.includes('INVALID_MEAL_TAG')) return '태그는 10자까지 쓸 수 있어요'
  if (message.includes('NO_GROUP_SELECTED')) return '그룹을 하나 이상 선택해 주세요'
  if (message.includes('RECORDED_AT_FUTURE')) return '아직 오지 않은 시각은 고를 수 없어요'
  if (message.includes('RECORDED_AT_DATE_CHANGED')) return '기록한 날의 시:분만 바꿀 수 있어요'
  if (message.includes('CAPTION_TOO_LONG')) return '메모는 100자까지 쓸 수 있어요'
  if (message.includes('POST_NOT_FOUND')) return '기록을 찾을 수 없어요'
  return '수정에 실패했어요. 잠시 후 다시 시도해 주세요.'
}
