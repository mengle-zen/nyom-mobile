import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

/**
 * 키보드가 올라와 있나. 화면 맨 아래 입력칸이 키보드가 떠 있을 때 홈 인디케이터 여백을
 * 빼고 키보드에 바로 붙도록 쓴다 — 여백을 그대로 두면 입력칸과 키보드 사이가 뜬다.
 */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    // iOS는 올라오기 시작할 때 바꿔 레이아웃이 키보드와 함께 움직이게 한다.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, () => setShown(true))
    const hide = Keyboard.addListener(hideEvent, () => setShown(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return shown
}
