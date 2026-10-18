import type { ImageSource } from 'expo-image'

/**
 * 기록 사진을 expo-image에 넘길 source.
 *
 * 서명 URL은 조회할 때마다 토큰이 바뀐다. expo-image는 기본으로 URL을 캐시 키로 쓰므로
 * 그대로 넘기면 같은 사진도 매번 "새 사진"이 되어 처음부터 다시 받는다 — 프로필·보드에
 * 들어갈 때마다 모든 사진이 비었다가 차오르던 원인이다. 바뀌지 않는 저장 경로를 캐시
 * 키로 고정해 한 번 받은 사진은 디스크 캐시에서 바로 띄운다.
 */
export function postImageSource(post: {
  image_url: string
  signedImageUrl: string | null
}): ImageSource | null {
  if (!post.signedImageUrl) return null
  return { uri: post.signedImageUrl, cacheKey: post.image_url }
}
