export type SlotBoardLayout = {
  /** 한 행에 놓는 타일 수 */
  cols: number
  /**
   * 타일 높이를 폭의 몇 배까지 허용하는가. `null`이면 남은 높이를 그대로 채운다.
   *
   * 타일이 `flex-1`뿐이면 멤버가 1명인 그룹에서 점선 한 칸이 화면 전체 높이로
   * 늘어나 가운데 카메라 아이콘만 떠 있는 화면이 된다. 사진은 정사각에 가깝게
   * 찍히므로 폭 기준 상한을 두면 1~2개일 때도 "카드"로 읽힌다.
   */
  maxAspect: number | null
  /** 상한에 걸려 여백이 남을 때 행 묶음을 위아래 가운데로 모을지 */
  center: boolean
}

/**
 * 멤버 수로 격자 모양을 정한다.
 *
 * 3명 이상은 2열로 깔면 타일이 자연히 세로 카드가 되어 상한이 필요 없다.
 * 문제는 1~2명 — 행이 적어 `flex-1`이 남은 높이를 전부 먹는다.
 */
export function slotBoardLayout(memberCount: number): SlotBoardLayout {
  if (memberCount <= 1) return { cols: 1, maxAspect: 1, center: true }
  if (memberCount === 2) return { cols: 1, maxAspect: 0.85, center: true }
  return { cols: 2, maxAspect: null, center: false }
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
