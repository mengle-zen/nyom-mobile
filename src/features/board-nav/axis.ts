export type Axis = 'h' | 'v'

/** 드래그 변위로 축을 결정한다. 임계 미만이면 미확정(null). */
export function decideAxis(dx: number, dy: number, threshold: number): Axis | null {
  if (Math.abs(dx) + Math.abs(dy) <= threshold) return null
  return Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
}

/** 탭한 x좌표가 좌/우 가장자리 영역(30%)인지 판정한다. */
export function edgeZone(relX: number, width: number): 'left' | 'right' | null {
  if (relX < width * 0.3) return 'left'
  if (relX > width * 0.7) return 'right'
  return null
}
