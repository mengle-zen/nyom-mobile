import { Pressable, Text, View } from 'react-native'

type Props = {
  message?: string
  onRetry?: () => void
}

/** 조회 실패 공통 화면. 보드는 어두운 배경 위에 얹히므로 흰 글씨를 쓴다. */
export function ErrorState({
  message = '잠시 문제가 생겼어요',
  onRetry,
}: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Text className="text-4xl">😵‍💫</Text>
      <Text className="text-center text-base font-bold text-white">{message}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="rounded-full bg-primary px-5 py-2.5 active:opacity-80"
        >
          <Text className="text-sm font-bold text-primary-foreground">다시 시도</Text>
        </Pressable>
      )}
    </View>
  )
}
