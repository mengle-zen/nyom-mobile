/** 타일을 가로로 얼마나 납작하게까지 허용하는가(가로/세로). 4:3 — 정사각 사진의 위아래가 최대 25% 잘린다. */
export const MAX_TILE_WIDE = 4 / 3

export type SlotBoardLayout = {
  /** 한 행에 놓는 타일 수 */
  cols: number
  rows: number
  /** 타일 크기(pt). 격자를 잴 수 있기 전(0)이면 0. */
  tileWidth: number
  tileHeight: number
}

/**
 * 멤버 수와 격자 영역 크기로 타일 배치를 정한다.
 *
 * 보드는 **스크롤하지 않는다** — "오늘을 한눈에" 보는 화면이라 남은 영역에 전부 맞춘다.
 * 1~2명은 한 줄(위아래로 쌓기), 3명 이상은 두 줄(2·2·2…, 정원 8명이면 4행).
 * 예전엔 2명을 옆으로, 5명 이상을 3열로 깔았는데, 세로가 긴 폰 화면에서는 열을 줄이고
 * 행을 늘리는 쪽이 타일이 더 크다(8명: 3열 121pt → 2열 약 170pt).
 *
 * 크기 규칙
 * - 세로는 정사각을 넘지 않는다 — 세로로 길면 접시 양옆이 날아간다.
 * - 가로는 세로의 4/3까지 늘려 화면을 채운다. 올린 사진은 정사각이라 그만큼 위아래가
 *   잘리지만, 빈 여백을 남기는 것보다 사진이 크게 보인다.
 *
 *   격자 378×540 · gap 8 기준
 *   1명   1열 378×378      2명   1열 355×266
 *   3~4명 2열 185×185      5~6명 2열 185×175     7~8명 2열 172×129
 */
export function slotBoardLayout(
  memberCount: number,
  grid: { width: number; height: number },
  gap: number,
): SlotBoardLayout {
  const n = Math.max(1, memberCount)
  const cols = n <= 2 ? 1 : 2
  const rows = Math.ceil(n / cols)
  if (grid.width <= 0 || grid.height <= 0) return { cols, rows, tileWidth: 0, tileHeight: 0 }

  const availWidth = (grid.width - gap * (cols - 1)) / cols
  const availHeight = (grid.height - gap * (rows - 1)) / rows
  const tileHeight = Math.min(availHeight, availWidth)
  const tileWidth = Math.min(availWidth, tileHeight * MAX_TILE_WIDE)
  return { cols, rows, tileWidth, tileHeight }
}

/**
 * 끼니 진행 배지 문구.
 *
 * 혼자 쓰는 그룹에서 `0/1 올림`은 사람 수를 세는 말이라 어색하다 — 셀 상대가
 * 없으면 "올렸는지"만 말하면 된다. 다 올린 그룹도 숫자보다 결론이 빠르다.
 */
export function slotCountLabel(filled: number, total: number): string {
  if (total <= 0) return ''
  if (total === 1) return filled > 0 ? '올렸어요' : '아직 안 올렸어요'
  if (filled >= total) return '모두 올렸어요'
  return `${filled}/${total} 올림`
}
