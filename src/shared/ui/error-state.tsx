import { Pressable, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

type Props = {
  message?: string
  onRetry?: () => void
  /** 보드처럼 어두운 배경이면 onDark(기본), 일반 화면이면 onLight. */
  variant?: 'onDark' | 'onLight'
}

/** 조회 실패 공통 화면. */
export function ErrorState({
  message = '잠시 문제가 생겼어요',
  onRetry,
  variant = 'onDark',
}: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Ionicons
        name="alert-circle-outline"
        size={40}
        color={variant === 'onDark' ? 'rgba(255,255,255,0.6)' : '#A89A82'}
      />
      <Text
        className={`text-center text-base font-bold ${
          variant === 'onDark' ? 'text-white' : 'text-foreground'
        }`}
      >
        {message}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="h-control-sm justify-center rounded-full bg-primary px-5 active:opacity-80"
        >
          <Text className="text-sm font-bold text-primary-foreground">다시 시도</Text>
        </Pressable>
      )}
    </View>
  )
}
