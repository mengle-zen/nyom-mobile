/**
 * 그룹 목록 카드에 붙는 가벼운 집계 — 멤버 수와 "오늘 올린 사람 수".
 *
 * 목록에서 그룹마다 보드를 통째로 불러오면(사진 signed URL까지) N배로 무거워진다.
 * 대신 그룹 전체를 한 번에 덮는 두 개의 얇은 쿼리(멤버 id · 오늘 게시물의 작성자 id)를
 * 받아 여기서 접는다. 집계 자체는 순수 함수라 서버(RPC/뷰) 변경이 필요하지 않다.
 */

export type GroupStats = {
  memberCount: number
  /** 오늘 이 그룹에 하나라도 올린 서로 다른 사람 수 */
  todayPosterCount: number
}

export type MemberIdRow = { group_id: string; user_id: string }
export type PostAuthorRow = { group_id: string | null; user_id: string }

/**
 * 멤버 행 · 오늘 게시물 행을 그룹별 집계로 접는다.
 *
 * 같은 사람이 오늘 여러 끼니를 올려도 "1명"으로 센다(목록에서 궁금한 건
 * 몇 장이 아니라 몇 명이 올렸는지다). 행이 하나도 없는 그룹도 0으로 채워
 * 카드가 "—" 같은 빈칸을 그리지 않게 한다.
 */
export function buildGroupStats(
  groupIds: string[],
  memberRows: MemberIdRow[],
  todayPostRows: PostAuthorRow[],
): Record<string, GroupStats> {
  const members = new Map<string, Set<string>>()
  const posters = new Map<string, Set<string>>()
  for (const id of groupIds) {
    members.set(id, new Set())
    posters.set(id, new Set())
  }

  for (const row of memberRows) members.get(row.group_id)?.add(row.user_id)
  for (const row of todayPostRows) {
    if (row.group_id) posters.get(row.group_id)?.add(row.user_id)
  }

  const out: Record<string, GroupStats> = {}
  for (const id of groupIds) {
    out[id] = {
      memberCount: members.get(id)?.size ?? 0,
      todayPosterCount: posters.get(id)?.size ?? 0,
    }
  }
  return out
}
