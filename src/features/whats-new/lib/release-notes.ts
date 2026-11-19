/**
 * 빌드마다 사용자에게 알릴 바뀐 점 — 업데이트 뒤 처음 열 때 「새로 바뀐 점」 시트에 뜬다.
 *
 * 빌드를 올릴 때(`app.json`의 `ios.buildNumber`) 여기에 그 빌드 항목을 더한다. 사용자가 알아챌
 * 변화만 적는다 — 내부 수정·성능 개선은 빼고, 고친 버그는 겪었던 사람이 알아볼 말로.
 * 아이콘은 Ionicons 이름. 한 빌드에 서너 개를 넘기지 않는다(시트가 길어진다).
 */
export type ReleaseNote = {
  icon:
    | 'images-outline'
    | 'copy-outline'
    | 'create-outline'
    | 'chatbubble-ellipses-outline'
    | 'grid-outline'
    | 'refresh-outline'
  title: string
  body: string
}

export const RELEASE_NOTES: { build: number; items: ReleaseNote[] }[] = [
  {
    build: 19,
    items: [
      {
        icon: 'images-outline',
        title: '사진 여러 장을 한 번에',
        body: '앨범에서 최대 10장까지 골라 올려요. 장마다 시각과 메모를 따로 정할 수 있어요.',
      },
      {
        icon: 'create-outline',
        title: '메모는 사진에서 바로',
        body: '내 사진을 열고 메모 줄을 누르면 그 자리에서 고쳐져요.',
      },
      {
        icon: 'chatbubble-ellipses-outline',
        title: '채팅 알림으로 들어가도 빠짐없이',
        body: '알림을 눌러 들어오면 새 메시지가 바로 보여요.',
      },
    ],
  },
  {
    build: 20,
    items: [
      {
        icon: 'copy-outline',
        title: '한 번에 올린 사진은 한 칸으로',
        body: '방 화면에서 겹친 카드로 묶여 보여요. 누르고 옆으로 밀어 넘겨 보세요.',
      },
    ],
  },
  {
    build: 21,
    items: [
      {
        icon: 'grid-outline',
        title: '프로필 그리드는 하루가 한 칸',
        body: '그날 먹은 사진이 한 칸에 모여요. 누르고 옆으로 밀어 넘겨 보세요.',
      },
      {
        icon: 'refresh-outline',
        title: '올릴 때 사진 돌리기',
        body: '사진 왼쪽 아래 버튼을 누르면 90°씩 돌아가요.',
      },
    ],
  },
]
