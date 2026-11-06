import type { Actions } from './actions'
import type { Scene } from './scenes'
import { SPACE, chipOf } from './theme'
import type { Ui } from './theme'

// 설명 창의 폭(글자 칸). 작은 "?" 상자 안에서는 폭이 저절로 잡히지 않아서 직접 정한다.
const HELP_CELLS = 26

/**
 * 도움말은 이해하기 어려운 곳에만 둔다(파일 목록처럼 한 줄이면 되는 안내는 화면에 직접 적는다).
 * 화면에는 "?"만 두고, 눌러서 패널 안에서 펼쳐 본다(하나만 열린다). 마우스를 올리면 같은 설명이 떠서 빠르게도 볼 수 있다.
 */
export const HELP = {
  scene: ['장면은 배너와 패널의 분위기, 음악 방송을 함께 바꿔요. ◀ ▶로 한 장면씩 넘겨요(배너의 ⟳와 같은 순서).', '배너 오른쪽 위: ▶ 음악 · ▤ 이 패널 · ⟳ 다음 장면 · ✕ 숨기기', '움직임 끔: 그림의 깜박임을 멈춰 정지한 그림으로 보여요(배너·패널 모두). 설정은 기억해요.'],
  music: [
    '24시간 인터넷 라디오예요(Windows 전용, 외부 방송이라 끊길 수 있어요).',
    '장면을 바꾸면 방송도 바뀌고, 음량은 −/+ 5단계예요.',
    '방송을 바꾸려면 ▸ 방송 바꾸기를 눌러요. 묶음 버튼(★ 즐겨찾기 · 잔잔 · 7080 · 게임 · 신스)을 누르면 그 묶음의 방송 버튼이 나와요. 방송은 장면마다 따로 기억하고(기본은 장면의 방송), ☆ 즐겨찾기를 누르면 ★ 묶음에 모여요.',
    '방송이 끊기면 점점 길게 기다리며 최대 5번 다시 연결해요. 그래도 안 되면 연결 실패로 알려요.',
    '연결에 실패하면 ▶로 다시 시도해요. 다른 채팅에서 켜면 이 채팅은 멈춰요.',
  ],
  quick: ['코드 리뷰: 바뀐 코드를 검토해요', '변경 커밋: 변경을 저장해요. 두 번 눌러야 실행돼요', '코드 정리: 코드를 다듬어 파일을 고쳐요. 두 번 눌러야 실행돼요', '누르면 버튼 아래에 진행 상태가 나와요. 끝났다고 나와도 결과는 대화창에서 확인해요'],
  todo: [
    '할 일을 적고 Enter로 더해요. 새 일이 맨 위에 쌓여요.',
    '☐를 누르면 완료(☑)가 되어 아래로 내려가요. ☆를 누르면 우선(★)이 되어 맨 위로 올라가요.',
    '완료한 것은 "완료한 것 지우기"로 한꺼번에 지워요. 모든 채팅이 같은 목록을 쓰고, 50개까지 둘 수 있어요.',
  ],
  usage: [
    '원은 지금까지 쓴 양이에요(남은 양이 아니에요).',
    '컨텍스트: 이 대화가 차지한 양이에요.',
    '5시간·주간 한도: 정해진 때마다 0으로 돌아가요. 남은 시간은 원 아래에 있어요.',
  ],
  status: [
    '올릴 커밋·받을 커밋은 원격 저장소와의 차이예요.',
    '바뀐 파일의 기호: + 새 파일, ~ 수정, - 삭제, > 이름 변경, ! 충돌(충돌이 먼저 나와요).',
    '숫자 세 칸은 오늘 하루 누적이에요(자정에 0으로). "수정 파일"은 오늘 고친 파일 수예요.',
    '프로젝트별 오늘: 오늘 두 프로젝트 이상에서 일했을 때만 나와요. 폴더 이름이 같으면 한 프로젝트로 묶이고, 폴더 이름만 저장해요(경로는 저장하지 않아요).',
    '아래 "이 채팅에서 만진 파일"은 이 채팅에서만 모은 목록이라 다른 값이에요.',
  ],
} as const

export type HelpId = keyof typeof HELP

type HelpMark = { scene: Scene; act: Actions; id: HelpId; isOpen: boolean }

/**
 * "?" 표시(열려 있으면 "×"). 누르면 설명이 패널 안에서 펼쳐진다: 호버 없이도(키보드·터치) 늘 같은 방식으로 볼 수 있다.
 * 닫혀 있을 때만 마우스 호버 설명 창(평소 숨겨진 절대 위치 상자)이 같은 hover 묶음으로 달려 있다. 앱에서 열리는지는 확인하지 못했다.
 */
export const helpMark = (ui: Ui, { scene, act, id, isOpen }: HelpMark) => {
  const { Box, Button, Text } = ui
  const scope = `help-${id}`
  const tip = (
    <Box
      position="absolute"
      top={1}
      right={0}
      width={HELP_CELLS}
      display="none"
      hover={{ scope, display: 'flex' }}
      flexDirection="column"
      gap={SPACE.line}
      backgroundColor={chipOf(scene)}
      paddingX={SPACE.control}
      paddingY={SPACE.control}
    >
      {HELP[id].map(line => (
        <Text size="footnote">{line}</Text>
      ))}
    </Box>
  )

  return (
    <Box position="relative">
      <Button
        key={`help:${id}`}
        plain
        dimColor={!isOpen}
        label={isOpen ? '×' : '?'}
        hover={{ scope, color: scene.accent }}
        onPress={() => act.toggleHelp(id)}
      />
      {isOpen ? [] : [tip]}
    </Box>
  )
}

/** 펼쳐진 설명. 머리글 바로 아래에 놓는다. */
export const helpCard = (ui: Ui, { scene, id }: { scene: Scene; id: HelpId }) => {
  const { Box, Text } = ui

  return (
    <Box
      key={`help-card:${id}`}
      flexDirection="column"
      gap={SPACE.line}
      backgroundColor={chipOf(scene)}
      paddingX={SPACE.control}
      paddingY={SPACE.control}
    >
      {HELP[id].map(line => (
        <Text size="footnote">{line}</Text>
      ))}
    </Box>
  )
}
