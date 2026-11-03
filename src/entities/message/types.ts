/** 답장이 인용하는 기록. 썸네일과 「수진의 12:31 기록」 라벨, 상세 열기에 쓴다. */
export type QuotedPost = {
  id: string
  user_id: string
  image_url: string
  signedImageUrl: string | null
  recorded_at: string
  created_at: string
}

export type RoomMessage = {
  id: string
  group_id: string
  user_id: string
  content: string
  created_at: string
  /** 답장이었나. 기록이 지워지면 post는 null이고 이 값만 남는다(「지운 기록」). */
  is_reply: boolean
  post: QuotedPost | null
}

/** 한 번에 불러오는 메시지 수. 위로 올리면 이만큼 더. */
export const MESSAGE_PAGE_SIZE = 50
export const MESSAGE_MAX_LENGTH = 1000
