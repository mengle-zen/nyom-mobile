import type { Href } from 'expo-router'
import type { Shot } from './downscale'
import { encodePhotos } from './photo-drafts'

/** 카메라를 쓸 수 없었던 이유 — 올리기 화면이 안내(CameraDenied)로 시작한다. */
export type CameraBlocked = 'denied' | 'settings' | 'unavailable'

/**
 * 올리기 화면으로 가는 링크. 사진은 카메라 버튼의 선택창에서 미리 골라 온다(2026-11-05 시안 B).
 * 여러 장(2026-11-17)은 `photos` 한 파라미터에 JSON으로 담는다(`decodePhotos`가 읽는다).
 */
export function uploadHref(params: {
  group?: string | null
  picked?: { shot: Shot; takenAt: Date; raw?: boolean }[]
  cameraBlocked?: CameraBlocked
}): Href {
  const q = new URLSearchParams()
  if (params.group) q.set('group', params.group)
  if (params.picked && params.picked.length > 0) {
    q.set(
      'photos',
      encodePhotos(
        params.picked.map(({ shot, takenAt, raw }) => ({
          uri: shot.uri,
          width: shot.width,
          height: shot.height,
          takenAt: takenAt.toISOString(),
          // 카메라 사진은 이미 줄였고, 앨범 사진은 원본이다 — 올리기 화면이 뒤에서 줄인다.
          raw: raw || undefined,
        })),
      ),
    )
  }
  if (params.cameraBlocked) q.set('cameraBlocked', params.cameraBlocked)
  const qs = q.toString()
  return `/upload${qs ? `?${qs}` : ''}` as unknown as Href
}
