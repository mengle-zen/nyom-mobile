import * as ImagePicker from 'expo-image-picker'
import type { CameraAttempt } from './capture-source'
import { capturedAtFromExif } from './captured-at'
import { downscaleForUpload, type Shot } from './downscale'
import { EDIT_SOURCE_EDGE } from './fit'

/** 사진 한 장을 받았거나, 받지 못한 이유(`fallbackAfterCamera`가 화면으로 옮긴다). */
export type PickResult = { kind: 'shot'; shot: Shot; takenAt: Date } | CameraAttempt

/** 편집 원본으로 쓸 크기로 줄인다 — 자르지 않는다(위치·확대는 미리보기 캔버스에서). */
function toShot(asset: ImagePicker.ImagePickerAsset): Promise<Shot> {
  return downscaleForUpload(
    { uri: asset.uri, width: asset.width, height: asset.height },
    EDIT_SOURCE_EDGE,
    { square: false },
  )
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

/**
 * 갤러리에서 한 장. 오늘 찍은 사진이면 그 촬영 시각을 먹은 시각으로 쓴다.
 * 불러오기 실패는 그대로 throw한다 — 호출부가 토스트로 알린다.
 */
export async function pickFromLibrary(): Promise<{ shot: Shot; takenAt: Date } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
    exif: true,
  })
  if (result.canceled) return null
  const asset = result.assets[0]
  if (!asset) return null
  return { shot: await toShot(asset), takenAt: capturedAtFromExif(asset.exif, new Date()) }
}
