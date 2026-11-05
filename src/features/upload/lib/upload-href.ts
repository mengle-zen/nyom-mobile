import type { Href } from 'expo-router'
import type { Shot } from './downscale'

/** 카메라를 쓸 수 없었던 이유 — 올리기 화면이 안내(CameraDenied)로 시작한다. */
export type CameraBlocked = 'denied' | 'settings' | 'unavailable'

/**
 * 올리기 화면으로 가는 링크. 사진은 카메라 버튼의 선택창에서 미리 골라 온다(2026-11-05 시안 B).
 * 라우트 파라미터는 문자열뿐이라 펼쳐서 넘긴다.
 */
export function uploadHref(params: {
  group?: string | null
  picked?: { shot: Shot; takenAt: Date }
  cameraBlocked?: CameraBlocked
}): Href {
  const q = new URLSearchParams()
  if (params.group) q.set('group', params.group)
  if (params.picked) {
    q.set('pickedUri', params.picked.shot.uri)
    q.set('pickedW', String(params.picked.shot.width))
    q.set('pickedH', String(params.picked.shot.height))
    q.set('pickedAt', params.picked.takenAt.toISOString())
  }
  if (params.cameraBlocked) q.set('cameraBlocked', params.cameraBlocked)
  const qs = q.toString()
  return `/upload${qs ? `?${qs}` : ''}` as unknown as Href
}
