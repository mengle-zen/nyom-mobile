export type SlotBoardLayout = {
  /** 한 행에 놓는 타일 수 */
  cols: number
  /**
   * 타일 높이를 폭의 몇 배까지 허용하는가. 항상 1 — 타일은 정사각이다.
   *
   * 왜 고정인가: 예전에는 멤버 수에 따라 1 / 0.85 / 무제한으로 갈렸다. 그래서 **같은
   * 사진이 그룹 인원에 따라 전혀 다르게 잘렸다.** 3명 이상에서는 상한이 없어 타일이
   * 약 1:1.6 세로 카드가 됐는데, 접시 양옆이 날아가는 비율이다. 음식 사진이 주인공인
   * 앱에서 레이아웃 편의가 크롭 비율을 정하면 안 된다.
   *
   * 업로드도 중앙 정사각으로 잘라 올리므로(`downscaleForUpload`) 찍은 그림과 보드에
   * 걸리는 그림이 같아진다.
   */
  maxAspect: 1
  /** 상한에 걸려 여백이 남을 때 행 묶음을 위아래 가운데로 모을지 */
  center: boolean
}

/**
 * 멤버 수로 격자 모양을 정한다.
 *
 * 보드는 **스크롤하지 않는다** — "오늘을 한눈에" 보는 화면이라 남은 높이에 전부
 * 맞춘다. 그래서 정사각을 유지하려면 인원이 늘 때 행을 늘리는 대신 **열을 늘려야**
 * 한다. 8명을 2열로 깔면 4행이고 정사각으로는 화면에 안 들어간다.
 *
 * 가용 높이 약 540pt · 격자 폭 약 378pt(gap 8) 기준으로 계산하면:
 *
 *   1명      1열  타일 378  →  1행 378pt
 *   2명      2열  타일 185  →  1행 185pt
 *   3~4명    2열  타일 185  →  2행 378pt
 *   5~6명    3열  타일 121  →  2행 249pt
 *   7~8명    3열  타일 121  →  3행 370pt   (그룹 정원 8명)
 *
 * 전부 들어간다. 대가는 5명 이상에서 타일이 작아지는 것(185 → 121pt)인데,
 * 스크롤 없는 보드에서 정사각을 지키려면 피할 수 없는 교환이다.
 *
 * 행이 상한보다 더 필요해지는 경우(가용 높이가 예상보다 짧은 기기)에는 flex가
 * 타일을 상한 **아래로** 눌러 가로형이 된다. 세로로 길어지는 일은 없다 — 음식
 * 사진에서 위아래가 잘리는 것이 좌우가 잘리는 것보다 낫다.
 */
export function slotBoardLayout(memberCount: number): SlotBoardLayout {
  if (memberCount <= 1) return { cols: 1, maxAspect: 1, center: true }
  if (memberCount <= 4) return { cols: 2, maxAspect: 1, center: true }
  return { cols: 3, maxAspect: 1, center: true }
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
