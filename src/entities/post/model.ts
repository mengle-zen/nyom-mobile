import { randomUUID } from 'expo-crypto'
// expo-file-system 57의 기본 진입점은 새 API(File/Directory/Paths)만 내보내고
// `readAsStringAsync`는 없다 — 그대로 두면 업로드가 "…is not a function"으로 죽는다.
// (시뮬레이터에서 실제로 재현: 갤러리 선택 후 전송 시 업로드 실패 토스트)
// 아래 함수의 로직은 그대로 두고 구 API가 사는 `/legacy` 진입점만 가리킨다.
import * as FileSystem from 'expo-file-system/legacy'
import { decode as decodeBase64 } from 'base64-arraybuffer'
import { supabase } from '@/shared/api/supabase'
import { dayRangeFromOffset, localDayKey } from './date-range'
import { dedupeByBatch } from './dedupe'
import { mealOf, type Meal, type MealSlotKey } from './board'

export type BoardPost = {
  id: string
  user_id: string
  image_url: string
  signedImageUrl: string | null
  caption: string | null
  meal_slot: MealSlotKey | null
  meal_tag: string | null
  created_at: string
  recorded_at: string
  reactions: PostReaction[]
}

export type PostAuthor = {
  id: string
  nickname: string
  avatar_url: string | null
}

export type PostReaction = {
  emoji: string
  user_id: string
}

type CreatePostParams = {
  userId: string
  /** 업로드할 이미지의 로컬 파일 URI (expo-image-picker의 OS 카메라 촬영 또는 갤러리 선택) */
  imageUri: string
  /** MIME 타입. 미지정 시 확장자로 추정한다. */
  mimeType?: string
  caption?: string | null
  /** 어느 그룹들에 올릴지 — 최소 1개. 각 그룹에 posts 행이 생기고 batch_id를 공유. */
  groupIds: string[]
  /** 끼니 — 기본 끼니 또는 사용자 태그 */
  meal: Meal
  /** 섭취 시각(ISO). 미지정 시 DB default now(). */
  recordedAt?: string
}

/**
 * 식단 사진을 storage에 한 번 올리고, 선택한 그룹 수만큼 posts 행을 생성한다.
 * - 같은 촬영의 행들은 batch_id를 공유한다(내 기록 중복 제거용).
 * - 경로는 RLS 정책상 반드시 `{userId}/...` 로 시작해야 한다.
 * - 배열 insert는 원자적(전체 성공/실패). 실패 시 방금 올린 파일을 best-effort로 정리한다.
 */
export async function createPostToGroups({
  userId,
  imageUri,
  mimeType,
  caption,
  groupIds,
  meal,
  recordedAt,
}: CreatePostParams): Promise<{ postId: string }> {
  if (groupIds.length === 0) throw new Error('NO_GROUP_SELECTED')

  const contentType =
    mimeType ?? (imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')
  const ext = contentType === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${randomUUID()}.${ext}`

  // RN의 fetch는 file:// URI에 대한 Blob 지원이 불안정하다.
  // base64로 읽어 ArrayBuffer로 넘기는 것이 Supabase + Expo의 안정적인 경로다.
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  const { error: uploadError } = await supabase.storage
    .from('meal-photos')
    .upload(path, decodeBase64(base64), { contentType, upsert: false })
  if (uploadError) throw uploadError

  const trimmed = caption?.trim()
  const batchId = randomUUID()
  const rows = groupIds.map((groupId) => ({
    user_id: userId,
    image_url: path,
    caption: trimmed ? trimmed : null,
    group_id: groupId,
    meal_slot: meal.slot,
    meal_tag: meal.tag,
    batch_id: batchId,
    ...(recordedAt ? { recorded_at: recordedAt } : {}),
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('posts')
    // supabase-js 2.106 generic 추론 우회. 런타임 안전.
    .insert(rows as never)
    .select('id')

  if (insertError) {
    // 글 생성 실패 시 고아 파일이 남지 않도록 정리 (실패해도 무시)
    await supabase.storage.from('meal-photos').remove([path])
    throw insertError
  }

  // batch의 아무 행 하나면 된다 — 되돌리기(delete_post_batch)가 batch 전체를 지운다.
  const first = (inserted as { id: string }[] | null)?.[0]
  if (!first) throw new Error('POST_NOT_CREATED')
  return { postId: first.id }
}

/** 최근 태그 칩에 보여 줄 개수 */
const RECENT_TAGS_LIMIT = 5

/**
 * 내가 최근에 쓴 끼니 태그, 최근 것부터 중복 없이.
 * 올리기에서 야식 같은 태그를 매번 다시 입력하지 않게 칩으로 보여 준다.
 * 한 촬영이 여러 그룹에 행을 만들어 같은 태그가 연달아 나오므로 넉넉히 읽어 접는다.
 */
export async function fetchMyRecentTags(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('meal_tag')
    .eq('user_id', userId)
    .not('meal_tag', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  const tags = ((data ?? []) as { meal_tag: string }[]).map((r) => r.meal_tag)
  return [...new Set(tags)].slice(0, RECENT_TAGS_LIMIT)
}

/** 사후 편집에서 다루는 batch 식별자 — batch_id가 없는 기존 행은 자기 id가 키. */
export type PostBatchRef = { id: string; batch_id: string | null }

/** 사후 편집 대상 batch의 현재 상태 (batch 전체가 공유하는 맥락 + 공유 그룹 목록). */
export type PostBatch = {
  /** 편집 RPC에 넘길 대표 행 id */
  postId: string
  caption: string | null
  recordedAt: string
  meal: Meal | null
  /** 현재 이 기록이 올라가 있는 그룹들 */
  groupIds: string[]
}

/**
 * 한 촬영(batch)의 행들을 모아 편집용 현재 상태를 만든다.
 * batch_id가 있으면 그 값으로, 없으면(기존 단일 행) 자기 id로 조회한다.
 * 조회는 RLS `posts_select_own`으로 본인 행만 보인다.
 */
export async function fetchPostBatch(
  userId: string,
  ref: PostBatchRef,
): Promise<PostBatch> {
  const base = supabase
    .from('posts')
    .select('id, group_id, caption, recorded_at, meal_slot, meal_tag, groups!posts_group_id_fkey(id)')
    .eq('user_id', userId)
    .order('id', { ascending: true })

  const { data, error } = ref.batch_id
    ? await base.eq('batch_id', ref.batch_id)
    : await base.eq('id', ref.id)

  if (error) throw error

  type Row = {
    id: string
    group_id: string | null
    groups: { id: string } | null
    caption: string | null
    recorded_at: string
    meal_slot: MealSlotKey | null
    meal_tag: string | null
  }
  const rows = (data ?? []) as unknown as Row[]
  if (rows.length === 0) throw new Error('POST_NOT_FOUND')

  // groups RLS로 탈퇴 그룹을 제외한다. 선택한 편집 가능 행을 우선하고, 없으면 id순 첫 행을 쓴다.
  const editable = rows.filter((r) => r.group_id === null || r.groups !== null)
  const rep = editable.find((r) => r.id === ref.id) ?? editable[0]
    ?? rows.find((r) => r.id === ref.id) ?? rows[0]

  return {
    postId: rep.id,
    caption: rep.caption,
    recordedAt: rep.recorded_at,
    meal: mealOf(rep),
    groupIds: editable
      .map((r) => r.group_id)
      .filter((id): id is string => id !== null),
  }
}

type UpdatePostBatchParams = {
  /** batch의 대표 행 id */
  postId: string
  /** 편집 후 공유할 그룹 전체 목록 (최소 1개) */
  groupIds: string[]
  caption: string | null
  /** 섭취 시각(ISO). null이면 유지 */
  recordedAt: string | null
  /** 끼니. null이면 유지 (mealChange가 계산) */
  meal: Meal | null
}

/**
 * batch 사후 편집 — 그룹 추가/제거 + 메모·시각·끼니를 한 트랜잭션으로 적용한다.
 * 여러 행에 걸친 update/delete/insert라 부분 실패가 생기지 않도록 RPC를 쓴다.
 * 그룹 멤버십 검증도 RPC(security definer) 안에서 이뤄진다.
 *
 * 끼니는 20260828050000_post_batch_meal_slot.sql에서 p_meal_slot으로 들어왔다.
 * 그 전에는 posts.meal_slot을 별도 statement로 직접 update하는 우회가 있었는데,
 * RPC와 원자적이지 않아 "끼니만 반영되고 나머지가 실패"하는 어긋남이 생겼다.
 * 태그(p_meal_tag)는 20261021000000_meal_tag.sql — 둘 중 하나만 보낸다.
 */
export async function updatePostBatch({
  postId,
  groupIds,
  caption,
  recordedAt,
  meal,
}: UpdatePostBatchParams): Promise<void> {
  if (groupIds.length === 0) throw new Error('NO_GROUP_SELECTED')

  // supabase-js 2.106 generic 추론 우회. 런타임 안전.
  const { error } = await supabase.rpc('update_post_batch', {
    p_post_id: postId,
    p_group_ids: groupIds,
    p_caption: caption,
    p_recorded_at: recordedAt,
    p_meal_slot: meal?.slot ?? null,
    p_meal_tag: meal?.tag ?? null,
  } as never)
  if (error) throw error
}

/**
 * batch 전체 삭제(= 기록 삭제). 마지막 그룹까지 빼는 것과 같은 동작이라
 * 호출 전 확인 모달을 반드시 거친다.
 * RPC가 돌려준 스토리지 경로의 파일도 정리한다(실패해도 무시 — 삭제 자체는 성공).
 */
export async function deletePostBatch(postId: string): Promise<void> {
  const { data, error } = await supabase.rpc('delete_post_batch', {
    p_post_id: postId,
  } as never)
  if (error) throw error

  const path = data as string | null
  if (path) {
    const { error: removeError } = await supabase.storage
      .from('meal-photos')
      .remove([path])
    if (removeError) console.error(removeError)
  }
}

/** 회고 캘린더의 선택일 타임라인 아이템 (내 기록). */
export type DayPost = {
  id: string
  image_url: string
  signedImageUrl: string | null
  caption: string | null
  meal_slot: MealSlotKey | null
  meal_tag: string | null
  created_at: string
  recorded_at: string
  batch_id: string | null
}

/**
 * 내 기록(전 그룹 통합) 중 특정 월에 기록이 있는 날짜 키 집합.
 * created_at만 조회(이미지 없음)해 캘린더 점 표시에 쓴다.
 */
export async function fetchMyRecordedDays(
  userId: string,
  year: number,
  month: number, // 0-based
): Promise<Set<string>> {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)

  const { data, error } = await supabase
    .from('posts')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())

  if (error) throw error
  const rows = (data ?? []) as { created_at: string }[]
  return new Set(rows.map((r) => localDayKey(new Date(r.created_at))))
}

/**
 * 내 기록(전 그룹 통합) 중 특정 날짜('YYYY-MM-DD')의 게시물을 시각순으로 조회하고
 * signed URL을 배치 생성한다(회고 캘린더 타임라인용).
 */
export async function fetchMyDayPosts(
  userId: string,
  dayKey: string,
): Promise<DayPost[]> {
  const [y, m, d] = dayKey.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 1)

  const { data, error } = await supabase
    .from('posts')
    .select('id, image_url, caption, meal_slot, meal_tag, created_at, recorded_at, batch_id')
    .eq('user_id', userId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('recorded_at', { ascending: true })

  if (error) throw error
  type Raw = Omit<DayPost, 'signedImageUrl'>
  // 같은 촬영(batch)이 여러 그룹에 올라갔어도 내 기록엔 1번만
  const rows = dedupeByBatch((data ?? []) as unknown as Raw[])
  if (rows.length === 0) return []

  const { data: signed } = await supabase.storage
    .from('meal-photos')
    .createSignedUrls(rows.map((r) => r.image_url), 3600)

  return rows.map((post, i) => ({
    ...post,
    signedImageUrl: signed?.[i]?.signedUrl ?? null,
  }))
}

/**
 * 그룹에서 기록이 있는 날짜 키 집합을 조회한다(캘린더 점 표시용).
 * created_at만 조회(이미지·signed URL 없음)하고 로컬 날짜 키로 정규화한다.
 * 기본 최근 90일 — 캘린더 브라우징 범위를 커버.
 */
export async function fetchGroupRecordedDays(
  groupId: string,
  now: Date = new Date(),
  sinceDays = 90,
): Promise<Set<string>> {
  const since = new Date(now)
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - sinceDays)

  const { data, error } = await supabase
    .from('posts')
    .select('created_at')
    .eq('group_id', groupId)
    .gte('created_at', since.toISOString())

  if (error) throw error
  const rows = (data ?? []) as { created_at: string }[]
  return new Set(rows.map((r) => localDayKey(new Date(r.created_at))))
}

/** 특정 그룹·날짜(offset)의 게시물을 조회하고 signed URL을 붙인다. */
export async function fetchBoardPosts(
  groupId: string,
  offset: number,
  now: Date = new Date(),
): Promise<BoardPost[]> {
  const { start, end } = dayRangeFromOffset(offset, now)

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, user_id, image_url, caption, meal_slot, meal_tag, created_at, recorded_at,
      reactions ( emoji, user_id )
    `)
    .eq('group_id', groupId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw error
  type Raw = Omit<BoardPost, 'signedImageUrl'>
  const rows = (data ?? []) as unknown as Raw[]
  if (rows.length === 0) return []

  // 개별 createSignedUrl(N번 왕복) 대신 배치 요청 1번으로 signed URL 생성
  const { data: signed } = await supabase.storage
    .from('meal-photos')
    .createSignedUrls(rows.map((r) => r.image_url), 3600)

  return rows.map((post, i) => ({
    ...post,
    signedImageUrl: signed?.[i]?.signedUrl ?? null,
  }))
}
