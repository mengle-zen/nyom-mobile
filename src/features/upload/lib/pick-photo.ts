import * as ImagePicker from 'expo-image-picker'
import type { CameraAttempt } from './capture-source'
import { capturedAtFromExif } from './captured-at'
import { downscaleForUpload, type Shot } from './downscale'
import { EDIT_SOURCE_EDGE } from './fit'

/** 사진 한 장을 받았거나, 받지 못한 이유(`fallbackAfterCamera`가 화면으로 옮긴다). */
export type PickResult = { kind: 'shot'; shot: Shot; takenAt: Date } | CameraAttempt

/** 편집 원본으로 쓸 크기로 줄인다 — 자르지 않는다(위치·확대는 미리보기 캔버스에서). */
export function prepareForEdit(shot: Pick<Shot, 'uri' | 'width' | 'height'>): Promise<Shot> {
  return downscaleForUpload(shot, EDIT_SOURCE_EDGE, { square: false })
}

function toShot(asset: ImagePicker.ImagePickerAsset): Promise<Shot> {
  return prepareForEdit({ uri: asset.uri, width: asset.width, height: asset.height })
}

/**
 * OS 기본 카메라로 촬영. 먹은 시각 = 찍은 순간.
 *
 * 취소(`canceled`)는 에러가 아니다. 시뮬레이터처럼 카메라가 없는 기기에서는 launch가
 * throw하거나 빈 결과를 주는데, 둘 다 「장치 부재」(`unavailable`)로 묶는다.
 */
export async function takePhoto(): Promise<PickResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) return { kind: 'denied', canAskAgain: permission.canAskAgain }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      // 위치·확대는 미리보기 캔버스에서 다룬다 — OS 크롭 화면을 한 겹 더 끼우지 않는다.
      allowsEditing: false,
    })
    if (result.canceled) return { kind: 'canceled' }
    const asset = result.assets[0]
    // 취소도 에러도 아닌데 사진이 없다 — 카메라가 정상 동작하지 않은 것으로 본다.
    if (!asset) return { kind: 'unavailable' }
    const takenAt = new Date()
    return { kind: 'shot', shot: await toShot(asset), takenAt }
  } catch {
    return { kind: 'unavailable' }
  }
}

/** 갤러리에서 고른 사진 한 장과 그 촬영 시각. `shot`은 줄이지 않은 원본이다. */
export type PickedPhoto = { shot: Shot; takenAt: Date }

/**
 * 갤러리에서 여러 장(최대 `limit`). 고른 순서대로 돌려준다. 오늘 찍은 사진이면 그 촬영 시각을
 * 먹은 시각으로 쓴다. 취소하면 빈 배열. 불러오기 실패는 그대로 throw한다 — 호출부가 토스트로 알린다.
 *
 * 원본을 그대로 돌려준다(2026-11-19). 여기서 장마다 줄이고 나서 화면을 열면 10장에 몇 초씩
 * 아무 표시 없이 기다렸다. 편집용으로 줄이기(`prepareForEdit`)는 올리기 화면이 뜬 뒤 뒤에서 한다.
 */
export async function pickFromLibrary(limit: number): Promise<PickedPhoto[]> {
  if (limit <= 0) return []
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
    exif: true,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    // 고른 순서에 번호를 붙여 보여 준다(iOS) — 올리기 화면의 썸네일 순서와 같다.
    orderedSelection: true,
    // iOS가 HEIC를 JPEG로 바꿔 넘기지 않게 원본 그대로 받는다 — 여러 장이면 이 변환이 가장 느렸다.
    // 어차피 편집·올리기 전에 우리가 JPEG로 줄인다.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  })
  if (result.canceled) return []
  const now = new Date()
  return result.assets.slice(0, limit).map((asset) => ({
    shot: {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType ?? 'image/jpeg',
    },
    takenAt: capturedAtFromExif(asset.exif, now),
  }))
}
