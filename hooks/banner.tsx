import type { Elements } from 'claude-code'

import type { GitInfo, RadioState, Usage } from '../types'
import type { Actions } from './actions'
import { ART } from './art'
import { fmtReset, fmtTokens, shortModel } from './format'
import type { Scene } from './scenes'
import { clipWidth, svgText, textWidth, WARN_COLOR, WARN_PERCENT } from './svg'

export type BannerData = {
  scene: Scene
  usage: Usage | null
  git: GitInfo | null
  model: string | null
  project: string
  now: number
  radio: RadioState
}

type Gauge = { name: string; percent: number | null; sub: string }

const BAR_WIDTH = 24
const GAUGE_X = [84, 111, 138] // 배너 칸 좌표(190칸 = 760px). 162칸 뒤 오른쪽은 버튼 2x2 자리.
// 배너는 760px 그대로 그려지는데 예전 작은 글자(8~10px)는 읽기 어려웠다. 칸 안에서 가능한 크게 쓴다.
const LABEL_SIZE = 2.8
const PERCENT_SIZE = 3.3
const SUB_SIZE = 3
const ROW2_Y = 10.6

const shortName = (name: string): string => name.split(' · ')[0] ?? name

export const gaugesOf = ({ scene, usage, now }: BannerData): Gauge[] => {
  const limit = (kind: string) => usage?.limits.find(l => l.kind === kind)
  const reset = (kind: string): string => {
    const found = limit(kind)

    return found?.resetsAt === undefined ? '' : `리셋 ${fmtReset(found.resetsAt, now)}`
  }
  const tokens = usage?.tokens ?? null

  return [
    {
      name: scene.gauges.context,
      percent: usage?.percent ?? null,
      sub: tokens === null ? '' : `${fmtTokens(tokens)}/${fmtTokens(usage?.window ?? 0)}`,
    },
    { name: scene.gauges.fiveHour, percent: limit('five_hour')?.percentUsed ?? null, sub: reset('five_hour') },
    { name: scene.gauges.week, percent: limit('seven_day')?.percentUsed ?? null, sub: reset('seven_day') },
  ]
}

const gaugeSvg = (x: number, g: Gauge, scene: Scene): string => {
  const percent = Math.min(100, g.percent ?? 0)
  const color = percent >= WARN_PERCENT ? WARN_COLOR : scene.accent
  const rect = (width: number, fill: string) =>
    `<rect x="${x}" y="6.1" width="${width}" height="1.5" ${fill} shape-rendering="crispEdges"/>`
  const percentText = g.percent === null ? '-' : `${Math.round(g.percent)}%`
  // 이름이 퍼센트(100%까지)와 겹치지 않게, 남는 폭에 맞춰 자른다.
  const label = clipWidth(shortName(g.name), LABEL_SIZE, BAR_WIDTH - textWidth(percentText, PERCENT_SIZE) - 2)

  return (
    svgText(x, 4.9, label, LABEL_SIZE, scene.muted) +
    svgText(x + BAR_WIDTH, 4.9, percentText, PERCENT_SIZE, color, 700, 'end') +
    rect(BAR_WIDTH, 'fill="#ffffff" fill-opacity=".14"') +
    rect(Number(((BAR_WIDTH * percent) / 100).toFixed(2)), `fill="${color}"`) +
    svgText(x, ROW2_Y, g.sub, SUB_SIZE, scene.muted)
  )
}

/** 배너 둘째 줄 왼쪽: 평소엔 장면의 한마디, 음악이 켜져 있으면 지금 나오는 방송. */
const noteOf = ({ scene, radio }: BannerData): { text: string; color: string } => {
  if (radio === 'playing') return { text: `♪ ${scene.music.label}`, color: scene.accent }
  if (radio === 'connecting') return { text: '♪ 연결 중…', color: scene.accent }

  return { text: scene.motto, color: scene.muted }
}

/** 배너 배경 그림 위에 글자와 게이지를 얹은 SVG(760x48). */
export const bannerSvg = (d: BannerData): string => {
  const { scene, git, model, project } = d
  const branch = git === null ? '' : `${git.branch}${git.changed > 0 ? ` +${git.changed}` : ''}`
  const line2 = [branch, model === null ? '' : shortModel(model)].filter(Boolean).join(' · ')
  const note = noteOf(d)
  const overlay =
    svgText(15, 5.4, scene.title, 3.6, scene.accent, 800) +
    svgText(15, ROW2_Y, clipWidth(note.text, 2.7, 36), 2.7, note.color) +
    svgText(54, 5.4, clipWidth(project === '' ? '-' : project, 3.1, 27), 3.1, '#f0f0f5', 700) +
    svgText(54, ROW2_Y, clipWidth(line2, 2.7, 28), 2.7, scene.muted) +
    gaugesOf(d)
      .map((g, i) => gaugeSvg(GAUGE_X[i] ?? 0, g, scene))
      .join('')

  return ART[scene.id].strip.replace('</svg>', `${overlay}</svg>`)
}

/** SVG를 못 그리는 화면(터미널 등)과 스크린 리더용 한 줄 글자. */
export const bannerText = (d: BannerData): string => {
  const gauges = gaugesOf(d).map(g => `${shortName(g.name)} ${g.percent === null ? '-' : `${Math.round(g.percent)}%`}`)

  return [d.scene.title, ...gauges, ...(d.git === null ? [] : [d.git.branch])].join(' · ')
}

export const RADIO_ICON: Record<RadioState, string> = { off: '▶', connecting: '…', playing: '■' }

type Ui = Elements['desktop']

// 버튼은 label을 그대로 그린다(이름과 글자를 따로 줄 수 없다). 긴 이름을 주면 배너 위에 겹쳐 그려지므로 글자 하나만 쓴다.
const musicButton = (ui: Ui, d: BannerData, act: Actions) => {
  const { Button } = ui

  return <Button key="music" plain label={RADIO_ICON[d.radio]} onPress={() => act.toggleRadio()} />
}

export const bannerView = (ui: Ui, d: BannerData & { isHidden: boolean }, act: Actions) => {
  const { Box, Button, Svg } = ui

  if (d.isHidden) {
    // 배너를 숨겨도 음악이 켜져 있으면 끌 수 있어야 한다.
    return (
      <Box flexDirection="row" gap={1}>
        <Button key="show" plain label="▣ 여관" onPress={() => act.setHidden(false)} />
        {d.radio === 'off' ? [] : [musicButton(ui, d, act)]}
      </Box>
    )
  }

  return (
    <Box position="relative">
      <Svg source={bannerSvg(d)} alt={bannerText(d)} width={760} height={48} />
      <Box position="absolute" top={0} right={1} flexDirection="column">
        <Box flexDirection="row" gap={1}>
          {musicButton(ui, d, act)}
          <Button key="panel" plain label="▤" onPress={() => act.openPanel()} />
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="shuffle" plain label="⟳" onPress={() => act.shuffle()} />
          <Button key="hide" plain label="✕" onPress={() => act.setHidden(true)} />
        </Box>
      </Box>
    </Box>
  )
}
