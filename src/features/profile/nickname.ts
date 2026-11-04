/** 닉네임 유효성 검사 */
export function validateNickname(nickname: string): string | null {
  const trimmed = nickname.trim()
  if (trimmed.length < 2) return '닉네임은 2자 이상이어야 해요'
  if (trimmed.length > 12) return '닉네임은 12자 이하여야 해요'
  if (!/^[가-힣a-zA-Z0-9_.\-\s]+$/.test(trimmed)) {
    return '한글, 영문, 숫자, _, ., - 만 사용할 수 있어요'
  }
  return null
}

/**
 * 가입 때 서버가 넣어 준 기본 닉네임 그대로인가 — `user_` + 내 id 앞 8자리.
 *
 * 카카오에서 닉네임 제공에 동의하지 않으면 이 값으로 가입된다(웹 저장소의
 * handle_new_user 트리거). 그대로면 친구들 화면에 `user_ce21c9fe`처럼 보이니
 * 앱에 들어오기 전에 온보딩에서 이름을 정하게 한다.
 */
export function isDefaultNickname(nickname: string, userId: string): boolean {
  return nickname === `user_${userId.slice(0, 8)}`
}
