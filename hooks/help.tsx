import type { Elements } from 'claude-code'

import type { Actions } from './actions'
import type { Scene } from './scenes'
import { SPACE, chipOf } from './theme'

type Ui = Elements['desktop']

// 설명 창의 폭(글자 칸). 작은 "?" 상자 안에서는 폭이 저절로 잡히지 않아서 직접 정한다.
const HELP_CELLS = 26

/** 항목마다 한 줄씩. 화면에는 "?"만 두고, 설명은 마우스를 올릴 때(또는 눌렀을 때) 보인다. */
export const HELP = {
  scene: ['장면은 배너와 패널의 분위기, 음악 방송을 함께 바꿔요.', '배너 오른쪽 위: ▶ 음악 · ▤ 이 패널 · ⟳ 다음 장면 · ✕ 숨기기'],
  music: ['24시간 인터넷 라디오예요. 장면을 바꾸면 방송도 바뀌어요.', '음량은 −/+로 5단계예요. 다른 채팅에서 켜면 이 채팅은 멈춰요.'],
  quick: ['리뷰: 바뀐 코드를 검토해요', '커밋: 변경을 저장해요. 두 번 눌러야 실행돼요', '정리: 코드를 다듬어요'],
  usage: ['원은 지금까지 쓴 양이에요(남은 양이 아니에요).', '5시간·주간은 정해진 때마다 0으로 돌아가요.', '컨텍스트는 이 대화가 차지한 양이에요.'],
  status: ['올릴 커밋·받을 커밋은 원격 저장소와의 차이예요.', '숫자 세 칸은 오늘(자정에 0으로) 센 값이에요.'],
  files: ['누르면 프롬프트에 @경로로 넣어 줘요.', '최근 8개까지 보여요.'],
} as const

type HelpMark = { scene: Scene; act: Actions; id: keyof typeof HELP }

/**
 * "?" 표시. 마우스를 올리면 같은 hover 묶음의 설명 창이 열린다(창은 평소 숨겨진 절대 위치 상자).
 * 눌러도 같은 설명이 잠깐 떠서, 마우스 없이 키보드로도 볼 수 있다. 설명 창은 "?"의 오른쪽 끝에 맞춰 왼쪽으로 펼쳐진다.
 */
export const helpMark = (ui: Ui, { scene, act, id }: HelpMark) => {
  const { Box, Button, Text } = ui
  const scope = `help-${id}`
  const lines = HELP[id]

  return (
    <Box position="relative">
      <Button
        key={`help:${id}`}
        plain
        label="?"
        hover={{ scope, color: scene.accent }}
        onPress={() => act.explain(lines.join(' · '))}
      />
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
        {lines.map(line => (
          <Text size="footnote">{line}</Text>
        ))}
      </Box>
    </Box>
  )
}
