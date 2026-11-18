import { hhmmFromDate } from '@/entities/post/date-range'
import { INITIAL_TRANSFORM, type CanvasTransform } from './canvas-transform'
import type { Shot } from './downscale'

/**
 * 여러 장 올리기(2026-11-17)의 순수 계산부.
 *
 * 한 장이 기록 하나다 — 장마다 찍힌 시각대로 시간 띠에 따로 놓이고, 시각·태그·메모·자르기도
 * 장마다 따로 정한다. 받는 곳만 모든 장에 같다.
 */

/** 한 번에 올릴 수 있는 사진 수 */
export const MAX_PHOTOS = 10

/** 올리기 화면에서 고치는 중인 사진 한 장 */
export type PhotoDraft = {
  /** 목록 key — 같은 파일을 두 번 골라도 겹치지 않게 따로 붙인다 */
  key: string
  /** 자르지 않은 편집 원본 */
  shot: Shot
  /** 찍은 시각 — 시각 칸의 「초기화」가 되돌릴 값 */
  capturedAt: Date
  /** 먹은 시각 'HH:mm' — 마지막으로 유효했던 값 */
  time: string
  /** 시각 칸을 다 채웠고 범위 안인지. 하나라도 false면 보내기를 막는다 */
  timeValid: boolean
  tag: string | null
  caption: string
  /** 다른 장으로 넘어갈 때 기억해 둔 캔버스 변환 — 돌아오면 이어서 고친다 */
  transform: CanvasTransform
  /** 그때 구워 둔 정사각 한 장. 손대지 않았으면 null(보낼 때 원본 가운데를 자른다) */
  baked: Shot | null
}

let seq = 0

export function newDraft(input: {
  shot: Shot
  takenAt: Date
  tag?: string | null
  caption?: string
}): PhotoDraft {
  return {
    key: `${++seq}:${input.shot.uri}`,
    shot: input.shot,
    capturedAt: input.takenAt,
    time: hhmmFromDate(input.takenAt),
    timeValid: true,
    tag: input.tag ?? null,
    caption: input.caption ?? '',
    transform: INITIAL_TRANSFORM,
    baked: null,
  }
}

/** 지금 장을 빼고, 보고 있던 자리에서 가장 가까운 장을 보여 준다. */
export function removeDraft(
  drafts: PhotoDraft[],
  index: number,
): { drafts: PhotoDraft[]; active: number } {
  const next = drafts.filter((_, i) => i !== index)
  return { drafts: next, active: Math.max(0, Math.min(index, next.length - 1)) }
}

/**
 * 라우트로 넘기는 사진 — 카메라 버튼의 선택창에서 고른 사진, 또는 되돌리기로 돌아온 사진과
 * 그때 입력값. 라우트 파라미터는 문자열뿐이라 JSON 한 덩어리로 넘긴다.
 */
export type PhotoParam = {
  uri: string
  width: number
  height: number
  /** ISO 시각 */
  takenAt: string
  tag?: string | null
  caption?: string
}

export function encodePhotos(photos: PhotoParam[]): string {
  return JSON.stringify(photos)
}

/** 망가진 값은 버린다 — 링크로 들어온 값은 믿을 수 없다. */
export function decodePhotos(raw: string | undefined): PhotoParam[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter(
      (p): p is PhotoParam =>
        typeof p === 'object' &&
        p !== null &&
        typeof p.uri === 'string' &&
        p.uri.length > 0 &&
        typeof p.width === 'number' &&
        typeof p.height === 'number' &&
        typeof p.takenAt === 'string' &&
        !Number.isNaN(new Date(p.takenAt).getTime()),
    )
    .slice(0, MAX_PHOTOS)
}
