import { randomUUID } from 'expo-crypto'
// expo-file-system 57의 기본 진입점에는 readAsStringAsync가 없다 —
// 구 API가 사는 `/legacy` 진입점을 가리킨다(entities/post/model.ts와 같은 이유).
import * as FileSystem from 'expo-file-system/legacy'
import { decode as decodeBase64 } from 'base64-arraybuffer'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { supabase } from '@/shared/api/supabase'
import {
  AVATAR_BUCKET,
  AVATAR_CONTENT_TYPE,
  AVATAR_SIZE,
  avatarObjectPath,
  orphanAvatarPaths,
} from './avatar'
import type { MealSlotKey } from '@/entities/post'
import type { Profile } from '@/types/database'

/** 마이페이지 그리드에 쓰는 내 게시물 최소 형태 */
export type MyPost = {
  id: string
  image_url: string
  signedImageUrl: string | null
  caption: string | null
  created_at: string
  /** 끼니 섭취 시각 — 그리드 오버레이 칩과 사후 편집의 기준 */
  recorded_at: string
  meal_slot: MealSlotKey | null
  meal_tag: string | null
  batch_id: string | null
}

type RawMyPost = Omit<MyPost, 'signedImageUrl'>

/** 마이페이지 그리드 페이지 크기 */
export const MY_POSTS_PAGE_SIZE = 30

/**
 * 내 끼니 총 개수 (프로필 통계용). 한 번의 촬영을 여러 그룹에 보내도 1끼니로 세도록
 * batch 기준 distinct 카운트 RPC(my_meal_count)를 쓴다.
 */
export async function fetchMyPostCount(): Promise<number> {
  // auth.uid() 기준으로 세므로 인자 불필요. supabase-js 2.106 generic 추론 우회.
  const { data, error } = await supabase.rpc('my_meal_count' as never)
  if (error) throw error
  return (data as number | null) ?? 0
}

/**
 * 내 게시물을 최신순 페이지 단위로 조회하고 signed URL을 배치 생성한다.
 * page는 0부터 시작.
 */
export async function fetchMyPostsPage(
  userId: string,
  page: number,
): Promise<MyPost[]> {
  const from = page * MY_POSTS_PAGE_SIZE
  const to = from + MY_POSTS_PAGE_SIZE - 1

  const { data, error } = await supabase
    .from('posts')
    .select('id, image_url, caption, created_at, recorded_at, meal_slot, meal_tag, batch_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  // dedup은 여기서 하지 않는다 — 페이지 크기 판정(getNextPageParam)이 raw 개수를
  // 기준으로 동작해야 하므로, 중복 제거는 페이지 flatten 후 소비 시점에서 한다.
  const rows = (data ?? []) as RawMyPost[]
  if (rows.length === 0) return []

  // 배치 요청 1번으로 signed URL 생성 (기존 N번 개별 호출 대체)
  const { data: signed } = await supabase.storage
    .from('meal-photos')
    .createSignedUrls(rows.map((r) => r.image_url), 3600)

  return rows.map((post, i) => ({
    ...post,
    signedImageUrl: signed?.[i]?.signedUrl ?? null,
  }))
}

/** 본인 프로필 한 줄 조회 */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export type ProfileUpdate = {
  nickname?: string
  avatar_url?: string | null
}

/** 본인 프로필 업데이트. RLS로 본인만 가능. */
export async function updateMyProfile(
  userId: string,
  updates: ProfileUpdate,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    // supabase-js 2.106의 generic 추론 이슈 우회. 런타임 안전.
    .update(updates as never)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data as Profile
}

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
 * 고른 사진을 512px 정사각 JPEG로 줄인다.
 *
 * 업로드 **전에** 줄이는 이유: 폰 사진은 4~8MB인데 화면에 뜨는 아바타는 최대
 * 104px다. 원본을 그대로 올리면 버킷 상한(2MB)에 걸리고, 통과해도 보드마다
 * 수 MB를 내려받게 된다. HEIC 같은 형식도 여기서 JPEG로 통일된다.
 *
 * 정사각 크롭은 ImagePicker의 `allowsEditing + aspect [1,1]`이 이미 해주므로
 * 여기서는 한 변만 맞춘다(웹은 canvas로 직접 크롭한다 — 브라우저 파일 선택에는
 * 크롭 UI가 없기 때문).
 */
export async function downscaleAvatar(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
    { compress: 0.8, format: SaveFormat.JPEG },
  )
  return result.uri
}

/**
 * 아바타를 스토리지에 올리고 공개 URL을 돌려준다(프로필 갱신은 하지 않는다).
 * 경로는 RLS(avatars_insert_own)상 반드시 `{userId}/...`로 시작해야 한다.
 */
export async function uploadAvatar(
  userId: string,
  localUri: string,
): Promise<{ path: string; publicUrl: string }> {
  const path = avatarObjectPath(userId, randomUUID())

  // RN의 fetch는 file:// URI에 대한 Blob 지원이 불안정하다.
  // base64로 읽어 ArrayBuffer로 넘기는 것이 Supabase + Expo의 안정적인 경로다.
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, decodeBase64(base64), {
      contentType: AVATAR_CONTENT_TYPE,
      upsert: false,
    })
  if (error) throw error

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

/**
 * 방금 올린 파일만 남기고 내 폴더의 옛 아바타를 지운다.
 *
 * 고아 파일 대책: 아바타는 캐시 때문에 매번 새 파일명으로 올리므로 교체할 때마다
 * 옛 파일이 남는다. **저장이 성공한 뒤** 폴더를 훑어 현재 것 외에는 전부 지운다.
 * "직전 URL을 파싱해 그것만 지우기"보다 이 방식이 좋은 이유는, 과거에 실패해
 * 쌓인 찌꺼기까지 한 번에 걷어내기 때문이다.
 * best-effort — 실패해도 프로필 저장 자체는 이미 성공했으므로 삼킨다.
 */
export async function pruneOldAvatars(
  userId: string,
  keepPath: string,
): Promise<void> {
  const keepName = keepPath.slice(keepPath.lastIndexOf('/') + 1)
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(userId, { limit: 100 })
  if (error || !data) {
    if (error) console.error(error)
    return
  }

  const stale = orphanAvatarPaths(userId, data.map((f) => f.name), keepName)
  if (stale.length === 0) return

  const { error: removeError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .remove(stale)
  if (removeError) console.error(removeError)
}

/**
 * 아바타 교체 한 번의 전체 흐름: 다운스케일 → 업로드 → profiles.avatar_url 갱신 →
 * 옛 파일 정리. 프로필 갱신이 실패하면 방금 올린 파일을 되돌린다(고아 방지).
 */
export async function changeMyAvatar(
  userId: string,
  localUri: string,
): Promise<Profile> {
  const resized = await downscaleAvatar(localUri)
  const { path, publicUrl } = await uploadAvatar(userId, resized)

  let profile: Profile
  try {
    profile = await updateMyProfile(userId, { avatar_url: publicUrl })
  } catch (e) {
    // DB에 안 걸린 파일은 아무도 참조하지 않는다 — 바로 치운다.
    await supabase.storage.from(AVATAR_BUCKET).remove([path])
    throw e
  }

  await pruneOldAvatars(userId, path)
  return profile
}
