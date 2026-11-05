import type { Elements, RenderChildren } from 'claude-code'

import type { Actions } from './actions'
import { helpCard, helpMark } from './help'
import type { HelpId } from './help'
import type { PanelData } from './panel'
import { SPACE, chipOf, surfaceOf } from './theme'
import type { Gap } from './theme'

type Ui = Elements['desktop']

// 패널 구역을 짜는 바탕 부품: 구역(띠)·안쪽 여백·머리글·접기 표시·"?"·칩. 구역 내용은 panel.tsx와 music.tsx에 있다.

export const isFolded = (d: PanelData, id: string): boolean => d.collapsed.includes(id)

/** 구역(위쪽 장면 고르기 줄): 바탕 그대로, 전체 폭, 위아래 여백. 안쪽 좌우 여백은 inset이 만든다(전체 폭 그림은 그 바깥에 둔다). */
export const band = (ui: Ui, background: string, children: RenderChildren[]) => {
  const { Box } = ui

  return (
    <Box flexDirection="column" backgroundColor={background} paddingY={SPACE.band} gap={SPACE.stack}>
      {children}
    </Box>
  )
}

/** 카드 왼쪽 강조 막대의 폭(글자 칸 수). 카드 안에 전체 폭 그림을 둘 때는 이만큼 줄여 그린다. */
export const STRIPE_COLUMNS = 1

/**
 * 구역 카드: 바탕보다 한 단계 밝은 배경 + 왼쪽 강조 막대. 카드 사이는 패널 바탕(root의 gap)이 비쳐 보여서
 * 어디서 구역이 시작하고 끝나는지 한눈에 보인다. 모든 구역(음악·빠른 실행·할 일·사용량·작업 현황·만진 파일)이 같은 모양이다.
 * 첫 자식은 머리글이다. 전체 폭 그림은 막대 오른쪽 폭(패널 폭 − STRIPE_COLUMNS)만큼만 쓸 수 있다.
 */
export const card = (ui: Ui, d: PanelData, children: RenderChildren[]) => {
  const { Box } = ui

  return (
    <Box flexDirection="row" alignItems="stretch" backgroundColor={surfaceOf(d.scene)}>
      <Box width={STRIPE_COLUMNS} backgroundColor={d.scene.accent} />
      <Box flexDirection="column" flexGrow={1} paddingY={SPACE.band} gap={SPACE.stack}>
        {children}
      </Box>
    </Box>
  )
}

export const inset = (ui: Ui, children: RenderChildren[], gap: Gap = SPACE.line) => {
  const { Box } = ui

  return (
    <Box flexDirection="column" paddingX={SPACE.edge} gap={gap}>
      {children}
    </Box>
  )
}

/** 항목의 "?" 표시. 이 항목의 설명이 펼쳐져 있으면 "×"가 된다. */
export const mark = (ui: Ui, d: PanelData, act: Actions, id: HelpId) =>
  helpMark(ui, { scene: d.scene, act, id, isOpen: d.openHelp === id })

/** 펼쳐진 설명(열려 있을 때만). 머리글 아래 안쪽 여백 목록에 이어 붙인다. */
export const cardOf = (ui: Ui, d: PanelData, id: HelpId): RenderChildren[] => (d.openHelp === id ? [helpCard(ui, { scene: d.scene, id })] : [])

/** 접기/펴기 표시(머리글 왼쪽). 접혀 있으면 ▸, 펴져 있으면 ▾. */
export const chevron = (ui: Ui, d: PanelData, act: Actions, id: string) => {
  const { Button } = ui

  return <Button key={`fold:${id}`} plain label={isFolded(d, id) ? '▸' : '▾'} onPress={() => act.toggleSection(id)} />
}

/** 접었을 때 머리글 오른쪽에 보이는 한 줄 요약. */
export const summary = (ui: Ui, d: PanelData, text: string) => {
  const { Text } = ui

  return (
    <Text color={d.scene.muted} size="caption" wrap="truncate-end">
      {text}
    </Text>
  )
}

/** 제목 줄: 왼쪽은 제목, 오른쪽은 개수·요약·"?" 같은 덧붙임. */
export const titleRow = (ui: Ui, title: RenderChildren, trailing: RenderChildren[]) => {
  const { Box } = ui

  return (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={SPACE.control}>
      {title}
      <Box flexDirection="row" alignItems="center" gap={SPACE.control}>
        {trailing}
      </Box>
    </Box>
  )
}

type HeaderSpec = { title: string; lead?: RenderChildren[]; trailing?: RenderChildren[]; isSub?: boolean }

/** 머리글(구역의 이름). isSub이면 소제목: 구역 안의 한 단계 아래 묶음이라 머리글보다 조용하다. */
export const header = (ui: Ui, d: PanelData, { title, lead = [], trailing = [], isSub = false }: HeaderSpec) => {
  const { Box, Text } = ui
  const text = isSub ? (
    <Text color={d.scene.muted} weight="semibold" size="footnote">
      {title}
    </Text>
  ) : (
    <Text color={d.scene.accent} weight="semibold">
      {title}
    </Text>
  )

  return titleRow(
    ui,
    <Box flexDirection="row" alignItems="center" gap={SPACE.line}>
      {[...lead, text]}
    </Box>,
    trailing,
  )
}

/** 칩: 상태 하나를 작은 배경 위에 올린다. */
export const chip = (ui: Ui, d: PanelData, child: RenderChildren) => {
  const { Box } = ui

  return (
    <Box backgroundColor={chipOf(d.scene)} paddingX={SPACE.control} paddingY={SPACE.line}>
      {child}
    </Box>
  )
}
