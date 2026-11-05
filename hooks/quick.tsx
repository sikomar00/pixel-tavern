import type { Elements } from 'claude-code'

import type { Work } from '../types'
import { QUICK } from './actions'
import type { Actions } from './actions'
import { card, cardOf, header, inset, mark } from './layout'
import type { PanelData } from './panel'
import { WARN_COLOR } from './svg'
import { SPACE } from './theme'

type Ui = Elements['desktop']

/** 누른 빠른 실행의 진행 상태 한 줄. 아무것도 안 눌렀으면 null. 실패만 경고색이다. */
const workLine = (work: Work): { text: string; isWarn: boolean } | null => {
  if (work.phase === 'idle') return null
  const name = QUICK.find(item => item.key === work.key)?.label ?? work.key

  if (work.phase === 'waiting') return { text: `◌ ${name} 대기 중…`, isWarn: false }
  if (work.phase === 'running') return { text: `● ${name} 진행 중…`, isWarn: false }
  if (work.reason === 'answer') return { text: `✓ ${name} 끝 · ${work.seconds}초`, isWarn: false }
  if (work.reason === 'aborted') return { text: `○ ${name} 중단됨`, isWarn: false }

  return { text: `✕ ${name} 실패`, isWarn: true }
}

/**
 * 영역 2: 빠른 실행. 버튼만 한 줄에 둔다. 확인이 필요한 버튼(커밋·정리)은 한 번 누르면 5초 동안 "한 번 더"로 바뀌고 안내가 붙는다.
 * 누른 버튼의 진행 상태(대기·진행 중·끝·중단·실패)는 버튼 아래 한 줄로 보인다.
 */
export const quick = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const buttons = QUICK.map(({ key, label }) => {
    const isArmed = key === d.armedKey

    return (
      <Button
        key={key}
        variant={isArmed ? 'primary' : undefined}
        label={isArmed ? '한 번 더' : label} // 라벨 길이가 같아야 줄이 흔들리지 않는다
        onPress={() => act.quick(key)}
      />
    )
  })
  const notice = QUICK.find(item => item.key === d.armedKey)?.confirm?.notice
  const armed =
    notice === undefined
      ? []
      : [
          <Text color={d.scene.accent} weight="semibold" size="footnote">
            {notice}
          </Text>,
        ]

  const line = workLine(d.work)
  const progress =
    line === null
      ? []
      : [
          <Text color={line.isWarn ? WARN_COLOR : d.scene.muted} size="footnote">
            {line.text}
          </Text>,
        ]

  return card(ui, d, [
    inset(ui, [header(ui, d, { title: '빠른 실행', trailing: [mark(ui, d, act, 'quick')] }), ...cardOf(ui, d, 'quick')]),
    inset(
      ui,
      [
        <Box flexDirection="row" gap={SPACE.control} flexWrap="wrap">
          {buttons}
        </Box>,
        ...progress,
        ...armed,
      ],
      SPACE.control,
    ),
  ])
}
