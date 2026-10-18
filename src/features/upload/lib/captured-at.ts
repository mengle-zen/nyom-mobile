/**
 * 먹은 시각 = 사진을 찍은 시각. 업로드 때는 묻지 않고, 틀렸으면 기록 편집에서 고친다.
 *
 * 카메라로 찍었으면 찍은 순간(호출부가 `now`를 넘긴다). 갤러리에서 고른 사진은 EXIF의
 * 촬영 시각을 쓰되, 업로드는 now-only라(날짜는 오늘 고정) **오늘 찍은 사진일 때만** 쓴다.
 * 어제 사진이나 EXIF가 없는 사진(스크린샷·메신저로 받은 사진)은 지금 시각으로 둔다.
 */
export function capturedAtFromExif(
  exif: Record<string, unknown> | null | undefined,
  now: Date,
): Date {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTimeDigitized ?? exif?.DateTime
  if (typeof raw !== 'string') return now

  // EXIF 형식: 'YYYY:MM:DD HH:MM:SS' (기기 로컬 시각, 시간대 없음)
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw)
  if (!m) return now
  const [, y, mo, d, h, mi, s] = m.map(Number)
  const shot = new Date(y, mo - 1, d, h, mi, s)
  if (Number.isNaN(shot.getTime())) return now

  const sameDay =
    shot.getFullYear() === now.getFullYear() &&
    shot.getMonth() === now.getMonth() &&
    shot.getDate() === now.getDate()
  if (!sameDay || shot.getTime() > now.getTime()) return now
  return shot
}
