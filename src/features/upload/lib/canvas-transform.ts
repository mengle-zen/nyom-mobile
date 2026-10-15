/**
 * 업로드 미리보기 캔버스(스토리식 편집)의 순수 계산부.
 *
 * 위치는 **캔버스 한 변에 대한 비율**로 들고 있다(x = 0.1 → 캔버스 폭의 10%만큼 오른쪽).
 * 키보드가 올라와 캔버스가 줄어도 같은 그림이 유지되고, 캡처 크기와도 무관해진다.
 *
 * 제스처 콜백(UI 스레드)에서 부르는 함수는 'worklet' 지시어를 단다. 지시어는 JS에서
 * 그냥 부를 때는 무시되므로 vitest에서도 그대로 검증된다.
 */

export type CanvasTransform = {
  /** 캔버스 중심 기준 사진 중심의 가로 오프셋(캔버스 한 변 = 1) */
  x: number
  /** 세로 오프셋(아래가 +) */
  y: number
  /** 1 = 사진의 짧은 변이 캔버스를 꽉 채움 */
  scale: number
  /** 회전(도). 시계 방향이 + */
  rotation: number
}

export const INITIAL_TRANSFORM: CanvasTransform = { x: 0, y: 0, scale: 1, rotation: 0 }

/** 너무 작으면 음식이 보이지 않고, 너무 크면 화소가 깨진다(편집 원본 2048px 기준). */
export const MIN_SCALE = 0.4
export const MAX_SCALE = 4

/** 중심에 이만큼(pt) 가까우면 가운데로 붙인다. */
export const SNAP_DISTANCE_PT = 8
/** 0°·90°·180°에 이만큼 가까우면 붙인다 — 의도치 않게 살짝 비뚤어지는 것을 막는다. */
export const SNAP_ANGLE_DEG = 4

export function clampScale(scale: number): number {
  'worklet'
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/** 중심 근처면 0으로 붙인다. `canvasSize`는 pt — 붙는 거리는 화면에서 느끼는 거리여야 한다. */
export function snapOffset(
  offset: number,
  canvasSize: number,
): { value: number; snapped: boolean } {
  'worklet'
  if (canvasSize > 0 && Math.abs(offset * canvasSize) < SNAP_DISTANCE_PT) {
    return { value: 0, snapped: true }
  }
  return { value: offset, snapped: false }
}

/** 가장 가까운 90° 배수 근처면 거기로 붙인다. -0은 0으로. */
export function snapAngle(deg: number): { value: number; snapped: boolean } {
  'worklet'
  const nearest = Math.round(deg / 90) * 90
  if (Math.abs(deg - nearest) < SNAP_ANGLE_DEG) {
    return { value: nearest === 0 ? 0 : nearest, snapped: true }
  }
  return { value: deg, snapped: false }
}

/** 손댄 적이 없는가 — 그렇다면 캡처 대신 원본에서 가운데를 잘라 화질을 지킨다. */
export function isUntouched(t: CanvasTransform): boolean {
  return t.x === 0 && t.y === 0 && t.scale === 1 && normalizeDegrees(t.rotation) === 0
}

function normalizeDegrees(deg: number): number {
  const r = deg % 360
  return r < 0 ? r + 360 : r
}

/**
 * scale=1일 때 사진의 표시 크기(pt). 짧은 변이 캔버스 한 변과 같다.
 * 크기를 못 읽었으면 정사각으로 둔다(가운데 자르기와 같은 그림).
 */
export function baseSize(
  image: { width: number; height: number },
  canvasSize: number,
): { width: number; height: number } {
  const { width, height } = image
  if (!(width > 0) || !(height > 0)) return { width: canvasSize, height: canvasSize }
  const k = canvasSize / Math.min(width, height)
  return { width: width * k, height: height * k }
}
