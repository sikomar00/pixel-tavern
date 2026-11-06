import type { Elements } from 'claude-code'

import type { Actions } from './actions'
import { CELLS } from './art/cells'
import { RADIO_ICON, gaugesOf as bannerGauges, noteOf } from './banner'
import type { BannerData } from './banner'
import { emblemPicture, hexToInt, scenePicture } from './cells'
import { shortModel } from './format'
import { card, chevron, header, inset, isFolded, mark, summary, cardOf } from './layout'
import { music } from './music'
import { files, settings, status } from './panel'
import type { PanelData } from './panel'
import { quick } from './quick'
import { WARN_COLOR, WARN_PERCENT } from './svg'
import { SPACE } from './theme'
import { todo } from './todo'
import { barCells, gaugesOf as usageGauges, usageSummary } from './usage'

// 터미널 화면: 배너와 패널. 터미널에는 Svg가 없어서 그림은 색 블록 그림(Raster, cells.ts)으로, 사용량 원은 글자 막대로 바꿔 그린다.
// 나머지 구역(음악·빠른 실행·할 일·작업 현황·파일)은 데스크톱과 같은 부품을 그대로 쓴다. 간격 이름(xs~xl)은 터미널이 글자 칸으로 알아서 환산한다.

type TermUi = Elements['terminal']
type Bar = { percent: number | null; width: number; color: string; muted: string }

/** 터미널 배너의 줄 수(엠블럼 5줄). 프롬프트 위 띠가 이보다 낮게 허락되면 한 줄 글자 띠로 대신한다. */
export const TERMINAL_BANNER_ROWS = 5
const BANNER_BAR = 12 // 배너 게이지 막대의 칸 수
const PANEL_BAR_MAX = 20 // 패널 사용량 막대: 5%마다 한 칸
const PANEL_BAR_MIN = 6
const NAME_CELLS = 11 // 패널 사용량의 이름 칸(가장 긴 "5시간 한도"가 10칸)
const PERCENT_CELLS = 6 // "리셋됨"이 6칸

/** 채운 칸(█)과 빈 칸(░)으로 이은 막대 한 줄. 값이 없으면 모두 빈 칸. */
const bar = (ui: TermUi, { percent, width, color, muted }: Bar) => {
  const { Box, Text } = ui
  const filled = percent === null ? 0 : barCells(percent, width)

  return (
    <Box flexDirection="row">
      {filled > 0 ? [<Text color={color}>{'█'.repeat(filled)}</Text>] : []}
      <Text color={muted} dimColor>
        {'░'.repeat(width - filled)}
      </Text>
    </Box>
  )
}

const colorOf = (d: BannerData, percent: number | null): string => (percent !== null && percent >= WARN_PERCENT ? WARN_COLOR : d.scene.accent)

/** 배너 게이지 하나(세 줄): 이름과 %, 막대, 보조 글(토큰 수·리셋까지 남은 시간). */
const bannerGauge = (ui: TermUi, d: BannerData, g: { name: string; percent: number | null; sub: string }) => {
  const { Box, Text } = ui
  const color = colorOf(d, g.percent)

  return (
    <Box flexDirection="column" width={BANNER_BAR + 2}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={d.scene.muted} wrap="truncate-end">
          {g.name}
        </Text>
        <Text color={color} weight="semibold">
          {g.percent === null ? '-' : `${Math.round(g.percent)}%`}
        </Text>
      </Box>
      {bar(ui, { percent: g.percent, width: BANNER_BAR, color, muted: d.scene.muted })}
      <Text color={d.scene.muted} dimColor wrap="truncate-end">
        {g.sub === '' ? ' ' : g.sub}
      </Text>
    </Box>
  )
}

/**
 * 터미널 배너(다섯 줄): 왼쪽에 장면의 엠블럼 그림, 오른쪽에 ① 장면 이름과 버튼 ② 방송·모토와 프로젝트·브랜치·모델 ③~⑤ 게이지 셋.
 * 숨기면 한 줄(`▣ 여관` + 사용량 요약 + 켜져 있을 때의 음악 버튼)만 남는다. 데스크톱 배너와 같은 버튼(▶ ▤ ⟳ ✕)을 둔다.
 */
export const termBanner = (ui: TermUi, d: BannerData & { isHidden: boolean }, act: Actions) => {
  const { Box, Button, Raster, Text } = ui
  const musicButton = <Button key="music" plain label={RADIO_ICON[d.radio]} onPress={() => act.toggleRadio()} />

  if (d.isHidden) {
    return (
      <Box flexDirection="row" gap={1}>
        <Button key="show" plain label="▣ 여관" onPress={() => act.setHidden(false)} />
        <Text color={d.scene.muted}>{usageSummary(d.scene, d.usage, d.now)}</Text>
        {d.radio === 'off' ? [] : [musicButton]}
      </Box>
    )
  }
  const emblem = emblemPicture(CELLS[d.scene.id], hexToInt(d.scene.base))
  const note = noteOf(d)
  const branch = d.git === null ? '' : `${d.git.branch}${d.git.changed > 0 ? ` +${d.git.changed}` : ''}`
  const where = [d.project === '' ? '-' : d.project, branch, d.model === null ? '' : shortModel(d.model)].filter(Boolean).join(' · ')

  return (
    <Box flexDirection="row" gap={2}>
      <Raster key="emblem" columns={emblem.columns} rows={emblem.rows} cells={emblem.cells} />
      <Box flexDirection="column" flexGrow={1}>
        <Box flexDirection="row" justifyContent="space-between" gap={2}>
          <Text color={d.scene.accent} weight="semibold" wrap="truncate-end">
            {d.scene.title}
          </Text>
          <Box flexDirection="row" gap={1}>
            {d.isMusicAvailable ? [musicButton] : []}
            <Button key="panel" plain label="▤" onPress={() => act.openPanel()} />
            <Button key="shuffle" plain label="⟳" onPress={() => act.shuffle()} />
            <Button key="hide" plain label="✕" onPress={() => act.setHidden(true)} />
          </Box>
        </Box>
        <Box flexDirection="row" justifyContent="space-between" gap={2}>
          <Text color={note.color} wrap="truncate-end">
            {note.text}
          </Text>
          <Text color={d.scene.muted} wrap="truncate-end">
            {where}
          </Text>
        </Box>
        <Box flexDirection="row" gap={2}>
          {bannerGauges(d).map(g => bannerGauge(ui, d, g))}
        </Box>
      </Box>
    </Box>
  )
}

/** 사용량 구역: 컨텍스트·5시간 한도·주간 한도를 글자 막대 세 줄로(`이름  ████░░░░  42%  보조 글`). 접으면 한 줄 요약. */
const usage = (ui: TermUi, d: PanelData, act: Actions) => {
  const { Box, Text } = ui
  const folded = isFolded(d, 'usage')
  // 막대 폭: 본문 − 카드 막대 1 − 좌우 여백 4 − 이름·%·사이 간격에 쓰는 칸 − 보조 글 16칸
  const room = d.frame.columns - 5 - NAME_CELLS - PERCENT_CELLS - 3 - 16
  const width = Math.max(PANEL_BAR_MIN, Math.min(PANEL_BAR_MAX, room))
  const rows = usageGauges(d.usage, d.now).map(g => {
    const color = colorOf(d, g.percent)

    return (
      <Box flexDirection="row" gap={SPACE.control}>
        <Box width={NAME_CELLS}>
          <Text weight="semibold" wrap="truncate-end">
            {g.name}
          </Text>
        </Box>
        {bar(ui, { percent: g.isStale === true ? null : g.percent, width, color, muted: d.scene.muted })}
        <Box width={PERCENT_CELLS} justifyContent="flex-end">
          <Text color={color} weight="semibold">
            {g.isStale === true ? '리셋됨' : g.percent === null ? '-' : `${Math.round(g.percent)}%`}
          </Text>
        </Box>
        <Text color={d.scene.muted} wrap="truncate-end">
          {g.sub}
        </Text>
      </Box>
    )
  })

  return card(ui, d, [
    inset(ui, [
      header(ui, d, {
        title: '사용량',
        lead: [chevron(ui, d, act, 'usage')],
        trailing: [folded ? summary(ui, d, usageSummary(d.scene, d.usage, d.now)) : mark(ui, d, act, 'usage')],
      }),
      ...(folded ? [] : cardOf(ui, d, 'usage')),
    ]),
    ...(folded ? [] : [inset(ui, rows, SPACE.control)]),
  ])
}

/**
 * 터미널 패널: 데스크톱과 같은 차례(장면 고르기 → 그림 → 음악 → 빠른 실행 → 할 일 → 사용량 → 작업 현황 → 파일)와 같은 카드 모양.
 * 그림은 패널 폭에 맞춰 줄인 색 블록 그림이고(정지), 움직임 켬/끔 버튼은 없다.
 */
export const termPanelView = (ui: TermUi, d: PanelData, act: Actions) => {
  const { Box, Raster } = ui
  const picture = scenePicture(CELLS[d.scene.id], d.usage?.percent ?? null, d.frame.columns, hexToInt(d.scene.base))

  return (
    <Box flexDirection="column" backgroundColor={d.scene.base} paddingBottom={SPACE.band} gap={SPACE.band}>
      <Box flexDirection="column">
        {settings(ui, d, act, false)}
        {isFolded(d, 'art')
          ? []
          : [
              <Box justifyContent="center">
                <Raster key="scene" columns={picture.columns} rows={picture.rows} cells={picture.cells} />
              </Box>,
            ]}
      </Box>
      {music(ui, d, act)}
      {quick(ui, d, act)}
      {todo(ui, d, act)}
      {usage(ui, d, act)}
      {status(ui, d, act)}
      {files(ui, d, act)}
    </Box>
  )
}
