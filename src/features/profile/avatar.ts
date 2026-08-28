/**
 * 아바타(프로필 사진)의 순수 로직 — 경로 규칙 · 정리 대상 판정.
 * 이미지 조작·네트워크는 api.ts에 있다.
 */

/** 아바타 전용 스토리지 버킷. 공개 버킷 — 근거는 웹 리포의 20260828040000_avatars_bucket.sql 주석. */
export const AVATAR_BUCKET = 'avatars'

/**
 * 저장할 아바타 한 변(px). 프로필 최대 노출 크기가 104px(온보딩)이라
 * 2배 DPR을 감안해도 512면 충분하다. JPEG 0.8로 보통 30~80KB.
 */
export const AVATAR_SIZE = 512

/** 다운스케일 후 올릴 형식. 버킷 allowed_mime_types 안에 있어야 한다. */
export const AVATAR_CONTENT_TYPE = 'image/jpeg'

/**
 * 스토리지 오브젝트 경로. 첫 세그먼트가 반드시 user_id여야 RLS를 통과한다
 * (avatars_insert_own 정책).
 *
 * 파일명을 매번 새로 뽑는 이유: 같은 경로에 덮어쓰면 공개 URL이 그대로라
 * 캐시(웹 브라우저 · RN expo-image)가 옛 사진을 계속 보여준다. 새 이름 → 새 URL.
 * 대신 옛 파일이 남으므로 저장 성공 후 정리한다(pruneOldAvatars).
 */
export function avatarObjectPath(userId: string, fileId: string): string {
  return `${userId}/${fileId}.jpg`
}

/**
 * 폴더 목록에서 지울 옛 아바타들의 경로.
 * `keepName` 하나만 남기고 나머지를 고아로 본다 — 한 사람의 아바타는 항상 1장이므로
 * 그 외에 남아 있는 것은 이전 교체가 남긴 찌꺼기다.
 */
export function orphanAvatarPaths(
  userId: string,
  names: string[],
  keepName: string,
): string[] {
  return names
    .filter((name) => name !== keepName && name !== '.emptyFolderPlaceholder')
    .map((name) => `${userId}/${name}`)
}
