const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export type DateHeading = {
  /** 크게 보여줄 주 라벨 */
  primary: string
  /** 주 라벨을 보완하는 작은 캡션. 없으면 null(오늘) */
  secondary: string | null
}

/**
 * 상대어(`그저께`·`N일 전`)를 쓰는 최대 오프셋.
 *
 * 한 주까지는 "며칠 전"이 바로 감이 오지만 그 이상은 세는 순간 계산이 되어버린다.
 * 그래서 7일부터는 절대날짜를 주 라벨로 올리고 「N일 전」을 캡션으로 내린다.
 */
const RELATIVE_MAX = 6

function absolute(offset: number, now: Date): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - offset)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
}

function relative(offset: number): string | null {
  if (offset === 0) return '오늘'
  if (offset === 1) return '어제'
  if (offset === 2) return '그저께'
  if (offset <= RELATIVE_MAX) return `${offset}일 전`
  return null
}

/**
 * 보드 상단 날짜 라벨을 **주 라벨 + 캡션 두 줄**로 만든다.
 *
 * 기존 `dateLabel`은 오늘/어제만 상대어이고 그 다음부터 곧바로 `8월 21일 (금)`이라
 * 가로 스와이프로 며칠을 거슬러 왔는지 감이 없었다. 여기서는 두 정보를 항상 같이
 * 준다 — 가까운 날은 상대어가 크고 날짜가 작게, 먼 날은 그 반대로.
 *
 * `dateLabel`은 웹과 공유하는 파일에 있어 그대로 두었다. 이 함수는 모바일 보드 전용.
 */
export function dateHeading(offset: number, now: Date): DateHeading {
  // 미래(음수)는 보드에서 클램프되어 오지 않지만, 와도 날짜만 보여주고 만다.
  if (offset < 0) return { primary: absolute(offset, now), secondary: null }
  if (offset === 0) return { primary: '오늘', secondary: null }

  const rel = relative(offset)
  return rel
    ? { primary: rel, secondary: absolute(offset, now) }
    : { primary: absolute(offset, now), secondary: `${offset}일 전` }
}
