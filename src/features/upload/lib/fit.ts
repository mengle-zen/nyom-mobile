/**
 * 업로드 전 다운스케일의 순수 계산부.
 * 네이티브 모듈(expo-image-manipulator)에 의존하지 않아 vitest에서 그대로 검증된다.
 */

/**
 * 업로드 이미지의 긴 변 상한(px).
 *
 * 보드 타일은 화면 절반, 프로필 그리드는 1/3 폭이라 3배 DPR을 감안해도 1280이면
 * 충분히 선명하다. 원본(아이폰 4032px, 3~5MB)을 그대로 올리면 base64 변환 메모리와
 * 업로드 시간이 몇 배로 늘어난다 — 웹앱도 같은 이유로 클라이언트에서 줄인다.
 */
export const MAX_UPLOAD_EDGE = 1280

/**
 * 편집 원본의 긴 변 상한(px). 미리보기 캔버스에서 확대한 뒤 1280 정사각으로 구워도
 * 깨지지 않을 만큼 남긴다. 원본(4032px)을 그대로 들고 있으면 미리보기가 무거워진다.
 */
export const EDIT_SOURCE_EDGE = 2048

/** JPEG 재인코딩 품질. 음식 사진에서 0.8은 육안상 열화가 거의 없다. */
export const UPLOAD_JPEG_QUALITY = 0.8

export type Size = { width: number; height: number }

/**
 * 종횡비를 유지한 채 긴 변이 `maxEdge` 이하가 되도록 줄인 크기.
 * - 이미 작으면 그대로 반환한다(확대하지 않는다).
 * - 결과는 정수로 반올림하고 최소 1px을 보장한다.
 * - 크기를 못 읽은 경우(0·NaN·음수)는 원본 값을 그대로 돌려주고 호출부가 리사이즈를
 *   건너뛰게 한다 — 추측해서 잘못 줄이는 것보다 원본 업로드가 안전하다.
 */
export function fitWithin(size: Size, maxEdge: number = MAX_UPLOAD_EDGE): Size {
  const { width, height } = size
  if (!isUsable(width) || !isUsable(height) || maxEdge <= 0) return size

  const longEdge = Math.max(width, height)
  if (longEdge <= maxEdge) return { width, height }

  const scale = maxEdge / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** ImageManipulator의 `crop()`에 그대로 넘길 수 있는 사각 영역. */
export type CropRect = {
  originX: number
  originY: number
  width: number
  height: number
}

/**
 * 중앙 정사각 크롭 영역. 짧은 변을 한 변으로 삼고 가운데를 잡는다.
 *
 * 왜 정사각인가: 보드 타일이 정사각이다(`widgets/slot-board/layout.ts`). 원본
 * 비율(3:4)을 그대로 올리면 타일에서 `contentFit="cover"`로 잘리는데, 그 잘림을
 * 업로드 시점에 확정해두면 프로필 그리드·상세까지 전부 같은 그림이 된다.
 *
 * 크롭이 불필요하거나(이미 정사각) 크기를 못 읽은 경우 `null`을 돌려준다 —
 * 호출부가 manipulator 왕복을 건너뛰게 하려는 것이다. `fitWithin`과 같은 방침으로,
 * 크기를 모를 때 추측해서 자르지 않는다.
 */
export function centerSquareCrop(size: Size): CropRect | null {
  const { width, height } = size
  if (!isUsable(width) || !isUsable(height)) return null
  if (width === height) return null

  const edge = Math.min(width, height)
  return {
    originX: Math.round((width - edge) / 2),
    originY: Math.round((height - edge) / 2),
    width: edge,
    height: edge,
  }
}

/** 리사이즈가 실제로 필요한지 — 불필요하면 manipulator 왕복을 건너뛴다. */
export function needsResize(
  size: Size,
  maxEdge: number = MAX_UPLOAD_EDGE,
): boolean {
  const { width, height } = size
  if (!isUsable(width) || !isUsable(height)) return false
  return Math.max(width, height) > maxEdge
}

function isUsable(n: number): boolean {
  return Number.isFinite(n) && n > 0
}
