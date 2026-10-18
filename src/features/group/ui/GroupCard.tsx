import { View, type ViewProps } from 'react-native'
import { CARD_SHADOW } from '@/shared/ui/shadow'

/**
 * 그룹 목록 카드의 껍데기. 「내 그룹」과 「탐색」이 같은 카드로 읽히게 한다.
 *
 * 전에는 두 탭이 각자 카드를 그렸고 radius·padding·그림자가 모두 달랐다:
 *
 *              내 그룹(GroupListItem)   탐색(DiscoverTab 인라인)
 *   radius     rounded-xl               rounded-lg
 *   shadow     인라인 웜톤 객체          shadow-sm 클래스(중성 검정)
 *   padding    px-4 py-3.5              px-4 py-3
 *
 * **padding은 여기서 주지 않는다.** `GroupListItem`은 여백을 Pressable 안쪽에
 * 두는데, 바깥에 주면 그 여백이 터치 영역에서 빠져 아이콘만 눌리는 과녁이 되기
 * 때문이다(그 파일 주석 참고). 그 결정을 깨지 않으려면 껍데기가 여백을 몰라야 한다.
 */
export function GroupCard({ children, style, className, ...rest }: ViewProps) {
  return (
    <View
      // className을 반드시 병합해야 한다. `{...rest}`로 흘려보내면 호출부가 넘긴
      // className이 이 껍데기의 것을 통째로 덮어써서 배경·라운드·flex-row가 전부
      // 사라진다(실제로 탐색 탭 카드가 배경 없이 세로로 쌓였다).
      className={`min-h-row flex-row items-center rounded-xl bg-card ${className ?? ''}`}
      style={[CARD_SHADOW, style]}
      {...rest}
    >
      {children}
    </View>
  )
}
