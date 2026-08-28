import { MEAL_SLOTS, deeplinkTarget } from '@/entities/post'
import { dateFromOffset, localDayKey } from '@/entities/post/date-range'

/**
 * 푸시 페이로드의 딥링크 파싱·정규화.
 *
 * 발송 트리거(SQL)가 만드는 URL은 웹 라우트 형식 그대로다:
 *   `/?group=<uuid>&date=YYYY-MM-DD&slot=lunch`  (리마인더는 그냥 `/`)
 * 네이티브에서는 이걸 보드 화면의 파라미터로 바꿔야 한다. 서버 문구·URL 생성은
 * 웹과 공유하는 자산이라 형식을 바꾸지 않고 클라이언트에서 해석한다.
 */

/** 보드가 다룰 수 있는 가장 과거(최근 2주) — 웹 home 화면의 MAX_OFFSET과 같다. */
export const MAX_DATE_OFFSET = 13

export type PushLinkParams = {
  group?: string
  date?: string
  slot?: string
}

/**
 * 푸시 url에서 쿼리 파라미터를 뽑는다. 경로 부분은 무시한다 — 웹 라우트 구조와
 * 네이티브 라우트 구조가 다르고, 우리에게 필요한 건 어느 그룹·언제·어느 끼니뿐이다.
 */
export function parsePushUrl(url: unknown): PushLinkParams {
  if (typeof url !== 'string' || url.length === 0) return {}
  const q = url.indexOf('?')
  if (q === -1) return {}

  const out: PushLinkParams = {}
  for (const pair of url.slice(q + 1).split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq))
    const value = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1))
    if (!value) continue
    if (key === 'group') out.group = value
    else if (key === 'date') out.date = value
    else if (key === 'slot') out.slot = value
  }
  return out
}

/**
 * 알림이 가리키는 보드 위치를 검증·정규화한다.
 *
 * `deeplinkTarget`(웹과 공유하는 순수 로직)으로 미래 날짜·범위 초과·알 수 없는
 * 끼니를 오늘/첫 끼니로 폴백시킨 뒤, 그 결과를 다시 'YYYY-MM-DD' + 슬롯 키로
 * 되돌려 보드 링크에 싣는다. 정규화를 여기서 끝내야 보드 화면이 깨진 값을
 * 방어할 필요가 없다.
 *
 * group이 없으면(리마인더 등) null — 어느 그룹으로 보낼지 알 수 없으므로
 * 호출부가 그룹 목록으로 보낸다.
 */
export function normalizePushTarget(
  params: PushLinkParams,
  now: Date,
  maxOffset: number = MAX_DATE_OFFSET,
): { group: string; date: string; slot: string } | null {
  if (!params.group) return null
  const target = deeplinkTarget(
    { date: params.date, slot: params.slot },
    now,
    maxOffset,
  )
  return {
    group: params.group,
    date: localDayKey(dateFromOffset(target.dateOffset, now)),
    slot: MEAL_SLOTS[target.slotIdx].key,
  }
}
