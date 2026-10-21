import type { Href } from 'expo-router'

/**
 * 보드 화면으로 가는 링크.
 *
 * 웹앱은 업로드 성공 후 `/`로 보냈는데 `/`는 `?group=`이 없으면 그룹 목록으로
 * 리다이렉트한다. 그래서 **방금 올린 기록이 보드에 뜬 걸 확인하지 못하고 튕겼다**
 * (docs/UX_FINDINGS.md E항). 기록 앱에서 "올렸다"는 확인은 토스트가 아니라
 * 보드에 내 타일이 채워진 걸 보는 것이므로, 여기서는 항상 group을 실어 보낸다.
 *
 * 타입 단언을 쓰는 이유: `(app)/board`는 다른 작업자가 만드는 화면이라
 * expo-router의 typed-routes 매니페스트에 아직 없을 수 있다. 라우트가 생기면
 * 단언 없이도 통과하지만, 그 전에도 이 파일 때문에 타입 체크가 깨지지 않게 한다.
 */
export function boardHref(
  groupId: string,
  /** 끼니는 slot(기본 끼니 키)과 tag(사용자 태그) 중 하나 — 알림 딥링크와 같은 모양 */
  extra?: { date?: string; slot?: string | null; tag?: string | null },
): Href {
  const params = new URLSearchParams({ group: groupId })
  if (extra?.date) params.set('date', extra.date)
  if (extra?.slot) params.set('slot', extra.slot)
  if (extra?.tag) params.set('tag', extra.tag)
  return `/(app)/board?${params.toString()}` as unknown as Href
}
