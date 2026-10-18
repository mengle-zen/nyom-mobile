import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * 마지막으로 보낸 그룹들 — 탭바 카메라로 들어왔을 때 받는 곳의 기본값.
 * 기기에만 둔다(계정 간 공유할 값이 아니고, 잃어도 한 번 고르면 다시 생긴다).
 */
const KEY = 'upload:lastRecipients'

export async function loadLastRecipients(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export async function saveLastRecipients(groupIds: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(groupIds))
  } catch {
    // 기억 못 해도 다음에 한 번 더 고르면 된다.
  }
}
