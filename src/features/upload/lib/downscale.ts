import {
  ImageManipulator,
  SaveFormat,
  type ImageResult,
} from 'expo-image-manipulator'
import {
  centerSquareCrop,
  fitWithin,
  needsResize,
  MAX_UPLOAD_EDGE,
  UPLOAD_JPEG_QUALITY,
  type Size,
} from './fit'

/** 업로드 직전의 사진 — 항상 로컬 파일 URI + 실제 크기를 함께 들고 다닌다. */
export type Shot = {
  uri: string
  width: number
  height: number
  /** createPostToGroups에 넘길 MIME. 다운스케일을 거치면 항상 image/jpeg. */
  mimeType: string
}

/**
 * 업로드 전 클라이언트 가공 — 중앙 정사각 크롭 후 다운스케일.
 *
 * 왜 자르는가: 보드 타일이 정사각이다(`widgets/slot-board/layout.ts`). 원본 비율을
 * 그대로 올리면 타일에서 `contentFit="cover"`로 잘리는데, 그 잘림을 업로드 시점에
 * 확정해두면 보드·프로필 그리드·상세가 전부 같은 그림이 된다. `centerSquareCrop` 참고.
 *
 * 왜 줄이는가: 아이폰 원본은 4032px·3~5MB다. `createPostToGroups`는 파일을 base64로
 * 통째로 읽어 ArrayBuffer로 디코드하므로 원본 크기가 그대로 메모리·업로드 시간이
 * 된다. 화면에서 쓰는 최대 해상도(보드 타일·프로필 그리드)를 감안하면 1280px이면
 * 충분하다. 웹앱도 같은 이유로 캔버스 리사이즈를 거친다.
 *
 * 실패해도 업로드 자체를 막지는 않는다 — 원본을 그대로 돌려주고 진행한다.
 * ("조금 느린 업로드"가 "업로드 불가"보다 낫다)
 */
export async function downscaleForUpload(
  source: Size & { uri: string },
  maxEdge: number = MAX_UPLOAD_EDGE,
): Promise<Shot> {
  const original: Shot = {
    uri: normalizeFileUri(source.uri),
    width: source.width,
    height: source.height,
    mimeType: guessMime(source.uri),
  }

  try {
    const context = ImageManipulator.manipulate(source.uri)

    // 크롭이 먼저다 — 이후 리사이즈 판단은 잘라낸 크기를 기준으로 해야 한다.
    const crop = centerSquareCrop(source)
    if (crop) context.crop(crop)
    const cropped: Size = crop ? { width: crop.width, height: crop.height } : source

    if (needsResize(cropped, maxEdge)) context.resize(fitWithin(cropped, maxEdge))

    const rendered = await context.renderAsync()
    const saved: ImageResult = await rendered.saveAsync({
      compress: UPLOAD_JPEG_QUALITY,
      format: SaveFormat.JPEG,
    })

    return {
      uri: normalizeFileUri(saved.uri),
      width: saved.width,
      height: saved.height,
      mimeType: 'image/jpeg',
    }
  } catch (err) {
    // 리사이즈 실패는 치명적이지 않다. 원본으로 계속 간다.
    console.warn('[upload] 다운스케일 실패 — 원본으로 업로드합니다', err)
    return original
  }
}

function guessMime(uri: string): string {
  return uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg'
}

/**
 * 로컬 경로에 `file://` 스킴을 보장한다.
 * expo-image-manipulator·expo-image-picker가 플랫폼·버전에 따라 스킴 없는 절대 경로를
 * 돌려주는 경우가 있는데, `<Image>`와 `FileSystem.readAsStringAsync`는 스킴이 없으면
 * 조용히 실패한다(에러도 안 나고 그냥 안 뜬다).
 */
function normalizeFileUri(uri: string): string {
  if (uri.startsWith('file://') || uri.includes('://')) return uri
  return `file://${uri}`
}
