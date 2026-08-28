import { supabase } from '@/shared/api/supabase'
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
    .select('id, image_url, caption, created_at, recorded_at, meal_slot, batch_id')
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
