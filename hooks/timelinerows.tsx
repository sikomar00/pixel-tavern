import type { TimelineEntry } from '../types'
import type { Actions } from './actions'
import { fmtClock } from './format'
import { isFolded } from './layout'
import type { PanelData } from './panel'
import { SPACE } from './theme'
import type { Ui } from './theme'

const LABEL = { prompt: '프롬프트', done: '작업 끝', stopped: '작업 중단' } as const

/** 기록 한 줄의 글: `작업 끝 · 파일 3개`(고친 파일이 없으면 종류만). */
export const entryText = (entry: TimelineEntry): string => `${LABEL[entry.kind]}${entry.files === undefined || entry.files === 0 ? '' : ` · 파일 ${entry.files}개`}`

/**
 * 오늘 작업 기록: "▸ 오늘 작업 기록 N개" 한 줄(눌러서 펴고 접는다, 기본은 접힘). 오늘 기록이 하나도 없으면 나오지 않는다.
 * 펴면 최근 10개가 시각 · 종류 순으로 보이고, 더 있으면 "…외 N개". 시각·종류·고친 파일 수만 있다(이름·글은 없다).
 */
export const timelineRows = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui

  if (d.timelineCount === 0) return []
  const isOpen = !isFolded(d, 'timeline')
  const rest = d.timelineCount - d.timeline.length

  return [
    <Button key="fold:timeline" plain label={`${isOpen ? '▾' : '▸'} 오늘 작업 기록 ${d.timelineCount}개`} onPress={() => act.toggleSection('timeline')} />,
    ...(isOpen
      ? d.timeline.map(entry => (
          <Box flexDirection="row" gap={SPACE.control}>
            <Text color={d.scene.muted} tabular>
              {fmtClock(entry.at)}
            </Text>
            <Text color={entry.kind === 'stopped' ? d.scene.muted : undefined} wrap="truncate-end">
              {entryText(entry)}
            </Text>
          </Box>
        ))
      : []),
    ...(isOpen && rest > 0
      ? [
          <Text color={d.scene.muted} size="caption">
            {`…외 ${rest}개`}
          </Text>,
        ]
      : []),
  ]
}
