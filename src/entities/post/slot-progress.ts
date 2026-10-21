import { boardPages, buildSlotBoard, type BoardPage } from './board'

/** 상단 끼니 칩 하나가 그리는 데이터 — 페이지 + "몇 명이 올렸나". */
export type SlotProgress = BoardPage & {
  /** 사용자 태그 페이지인가(칩 모양을 기본 끼니와 구분한다) */
  isTag: boolean
  /** 그 끼니에 기록을 올린 멤버 수 */
  filled: number
  /** 그룹 멤버 수 */
  total: number
}

type MemberLike = { user_id: string }
type PostLike = {
  user_id: string
  meal_slot: string | null
  meal_tag?: string | null
  created_at: string
  recorded_at?: string
}

/**
 * 그날 보드의 페이지(기본 끼니 넷 + 태그들) 각각의 올림 상태를 한 번에 계산한다.
 *
 * 웹앱은 슬롯 이동 컨트롤이 없어(보이지 않는 가장자리 탭이 전부였다) 하루가 4끼니라는
 * 사실 자체를 알 수 없었다(docs/UX_FINDINGS.md B항). 여기서는 끼니 칩을 상단에 상시
 * 노출하고, 각 칩이 자기 끼니의 올림 상태를 점으로 함께 보여준다 — 진행바가 하던
 * "지금 몇 번째 끼니인가"와 "누가 올렸나"를 칩 하나가 대신한다.
 *
 * 멤버당 1칸으로 세므로(`buildSlotBoard`와 같은 규칙) 한 멤버가 같은 끼니에 두 번
 * 올려도 filled는 1만 올라간다.
 */
export function slotProgress<M extends MemberLike, P extends PostLike>(
  members: M[],
  posts: P[],
): SlotProgress[] {
  return boardPages(posts).map((page) => ({
    ...page,
    isTag: page.meal.tag !== null,
    filled: buildSlotBoard(members, posts, page.meal).filledCount,
    total: members.length,
  }))
}

/** 페이지 인덱스를 0..count-1 안으로 자른다(칩·스와이프 공용). */
export function clampSlotIdx(idx: number, count: number): number {
  if (idx < 0) return 0
  const last = count - 1
  return idx > last ? last : idx
}

/**
 * 보고 있던 페이지 키가 지금 페이지 목록의 몇 번째인가.
 *
 * 날짜를 옮겨도 끼니는 그대로 두는데(board 화면 참고), 태그 페이지는 그날 누가 그
 * 태그로 올렸을 때만 있다. 없으면 간식으로 보여 준다 — 태그는 대개 간식 언저리의
 * 이름이고(야식·디저트), 아침으로 튀면 맥락이 끊긴다. 키는 바꾸지 않으므로
 * 그 태그가 있는 날로 돌아가면 다시 그 페이지가 열린다.
 */
export function pageIndex(pages: { key: string }[], key: string): number {
  const idx = pages.findIndex((p) => p.key === key)
  if (idx >= 0) return idx
  if (key.startsWith('tag:')) {
    const snack = pages.findIndex((p) => p.key === 'snack')
    if (snack >= 0) return snack
  }
  return 0
}
