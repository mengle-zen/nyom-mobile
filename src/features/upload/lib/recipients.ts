/**
 * 업로드의 받는 곳(그룹) 기본값과 표시 — 순수 계산부.
 *
 * 그룹 선택 화면을 없애고 「○○에 보내기」 버튼 하나로 보내므로, 기본값이 곧 정답이어야 한다.
 * 우선순위: 들고 온 그룹(보드에서 진입) → 마지막으로 보낸 그룹들 → 그룹이 하나뿐이면 그 그룹.
 * 나간 그룹이 기억에 남아 있을 수 있어 항상 지금 내 그룹으로 거른다.
 */
export function defaultRecipients({
  fromGroup,
  lastSent,
  myGroupIds,
}: {
  fromGroup?: string | null
  lastSent: string[]
  myGroupIds: string[]
}): string[] {
  const mine = new Set(myGroupIds)
  if (fromGroup && mine.has(fromGroup)) return [fromGroup]
  const remembered = lastSent.filter((id) => mine.has(id))
  if (remembered.length > 0) return remembered
  if (myGroupIds.length === 1) return [myGroupIds[0]]
  return []
}

/**
 * 보내기 버튼 문구. 받는 곳 이름이 버튼에 박혀 있어야 엉뚱한 그룹에 보내는 실수가 준다.
 * 여러 장이면 장 수도 박는다 — 몇 개의 기록이 생기는지 보내기 전에 보이게.
 */
export function sendLabel(names: string[], photoCount = 1): string {
  if (names.length === 0) return '받는 곳을 골라 주세요'
  const where = names.length === 1 ? names[0] : `${names.length}곳`
  return photoCount > 1 ? `${where}에 ${photoCount}장 보내기` : `${where}에 보내기`
}

/** 「받는 곳」 줄에 쓰는 요약 — 첫 그룹 이름 + 나머지 수 */
export function recipientSummary(names: string[]): string {
  if (names.length === 0) return '고르기'
  if (names.length === 1) return names[0]
  return `${names[0]} 외 ${names.length - 1}곳`
}
