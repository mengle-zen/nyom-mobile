/**
 * OS 카메라를 한 번 호출한 결과를, 사진이 없는 업로드 화면이 보여줄 상태로 옮긴다.
 *
 * 촬영은 이제 OS 카메라(`expo-image-picker`의 `launchCameraAsync`)가 맡는다.
 * 앱에는 뷰파인더가 없으므로 "촬영이 성사되지 않은" 경우 화면에 남는 게 없다 —
 * 어떤 이유로 못 찍었는지에 따라 어디로 떨어뜨릴지가 이 화면의 유일한 분기다.
 *
 * 네이티브 모듈에 의존하지 않는 순수 함수라 vitest에서 그대로 검증된다.
 */

/** 카메라 호출 한 번의 결과(사진을 받은 경우는 분기가 없으므로 제외) */
export type CameraAttempt =
  /** 사용자가 OS 카메라에서 취소 */
  | { kind: 'canceled' }
  /** 카메라 권한 거부 */
  | { kind: 'denied'; canAskAgain: boolean }
  /** 카메라를 아예 열지 못함 — 시뮬레이터처럼 장치가 없는 환경 */
  | { kind: 'unavailable' }

export type CaptureFallback =
  /** 촬영 / 갤러리 선택 화면 */
  | { stage: 'choose' }
  /** 촬영 경로가 막혔음을 알리고 갤러리로 유도 (CameraDenied) */
  | { stage: 'blocked'; reason: string }

/** 아직 물어볼 수 있는 상태의 권한 거부 — 다시 시도가 실제로 의미가 있다 */
export const REASON_DENIED_RETRYABLE =
  '카메라 권한을 허용하면 바로 찍을 수 있어요.\n지금은 갤러리에서 사진을 골라 올릴 수 있어요.'

/** 영구 거부 — 앱 안에서는 되돌릴 수 없으니 설정 경로를 알려준다 */
export const REASON_DENIED_SETTINGS =
  '설정 → 뇸 → 카메라에서 권한을 허용하거나,\n아래에서 갤러리 사진을 골라주세요.'

/** 장치에 카메라가 없음(시뮬레이터 등) */
export const REASON_CAMERA_UNAVAILABLE =
  '이 기기에서 카메라를 열 수 없어요.\n아래에서 갤러리 사진을 골라 올릴 수 있어요.'

/**
 * 취소는 "실패"가 아니다. 마음이 바뀐 것뿐이므로 업로드 화면 밖으로 튕겨내지 않고
 * 선택 화면에 세워 둔다 — 갤러리로 넘어갈 수도, 다시 찍을 수도, 닫을 수도 있게.
 * 반대로 권한 거부·장치 부재는 촬영 버튼을 다시 눌러도 같은 벽이라, 이유를 말하고
 * 갤러리를 눈에 띄게 내민다.
 */
export function fallbackAfterCamera(attempt: CameraAttempt): CaptureFallback {
  switch (attempt.kind) {
    case 'canceled':
      return { stage: 'choose' }
    case 'denied':
      return {
        stage: 'blocked',
        reason: attempt.canAskAgain ? REASON_DENIED_RETRYABLE : REASON_DENIED_SETTINGS,
      }
    case 'unavailable':
      return { stage: 'blocked', reason: REASON_CAMERA_UNAVAILABLE }
  }
}
