/**
 * 내 기록 중복 제거 — 한 번의 촬영을 여러 그룹에 보내면 posts 행이 N개 생기므로,
 * `batch_id`가 같은 행은 하나로 접는다(순서 보존, 첫 행 유지).
 * batch_id가 없는 행(단일/기존)은 id를 키로 개별 유지.
 */
export function dedupeByBatch<T extends { id: string; batch_id?: string | null }>(
  rows: T[],
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of rows) {
    const key = r.batch_id ?? r.id
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}
