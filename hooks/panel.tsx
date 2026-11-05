import type { Elements } from 'claude-code'

import type { ModeId, Mood, RadioState, SceneId, Today } from '../types'
import { QUICK } from './actions'
import type { Actions, QuickKey } from './actions'
import { ART, composeScene } from './art'
import type { BannerData } from './banner'
import { shortPath, todayKey } from './format'
import { LIMITS_HEIGHT, LIMITS_WIDTH, limitsSvg } from './limits'
import { MODES, SCENES } from './scenes'
import type { Scene } from './scenes'
import { clip } from './svg'
import { MAX_VOLUME } from './volume'

export type PanelData = BannerData & {
  mood: Mood
  today: Today
  chatFiles: string[]
  isCommitArmed: boolean
  volume: number
}

type Ui = Elements['desktop']

// 글자 위계: 구역 제목(heading) > 가장 중요한 값(heading/semibold) > 본문(body) > 보조 설명(footnote) > 로그(caption)
const MAX_FILES = 8
const SCENE_WIDTH = 340
const SCENE_HEIGHT = 384

/** 제목이 붙은 구역. 배경은 장면 색이라 그림 아래까지 색이 이어진다. */
const section = (ui: Ui, scene: Scene, title: string, children: unknown[]) => {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column" backgroundColor={scene.base} paddingX={1} paddingTop={1}>
      <Text color={scene.accent} weight="semibold" size="heading">
        {title}
      </Text>
      {children}
    </Box>
  )
}

const pickers = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Select } = ui
  const scenes = MODES.find(entry => entry.id === d.mood.mode)?.scenes ?? []

  return (
    <Box flexDirection="column" backgroundColor={d.scene.base} paddingX={1} paddingTop={1} gap={1}>
      <Select
        key="mode"
        label="모드"
        options={MODES.map(entry => ({ value: entry.id, label: entry.label }))}
        value={d.mood.mode}
        onSelect={value => act.setMode(value as ModeId)}
      />
      <Select
        key="scene"
        label="장면"
        options={scenes.map(id => ({ value: id, label: SCENES[id].title }))}
        value={d.scene.id}
        onSelect={value => act.setScene(value as SceneId)}
      />
    </Box>
  )
}

const RADIO_STATUS: Record<RadioState, string> = { off: '○ 멈춤', connecting: '◌ 연결 중…', playing: '● 재생 중' }

/** 음량 −/+ 와 현재 단계(●가 채운 칸). 켜져 있으면 새 음량으로 방송을 다시 연결한다. */
const volumeControls = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const bars = '●'.repeat(d.volume) + '○'.repeat(MAX_VOLUME - d.volume)

  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      <Text color={d.scene.muted} size="footnote">
        음량
      </Text>
      <Button key="volume-down" label="−" onPress={() => act.setVolume(d.volume - 1)} />
      <Text>{bars}</Text>
      <Button key="volume-up" label="+" onPress={() => act.setVolume(d.volume + 1)} />
    </Box>
  )
}

const musicSection = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const isOn = d.radio !== 'off'

  return section(ui, d.scene, '음악', [
    <Text weight="semibold">{d.scene.music.label}</Text>,
    <Box flexDirection="row" gap={1}>
      <Text color={isOn ? d.scene.accent : d.scene.muted} weight="semibold" size="footnote">
        {RADIO_STATUS[d.radio]}
      </Text>
      <Text color={d.scene.muted} size="footnote">
        24시간 인터넷 라디오
      </Text>
    </Box>,
    <Box flexDirection="row" gap={2} alignItems="center" flexWrap="wrap" paddingTop={1}>
      <Button
        key="radio"
        variant={isOn ? 'secondary' : 'primary'}
        label={isOn ? '■ 정지' : '▶ 재생'}
        onPress={() => act.toggleRadio()}
      />
      {volumeControls(ui, d, act)}
    </Box>,
  ])
}

const QUICK_NOTE: Record<QuickKey, string> = {
  review: '코드 검토',
  commit: '변경 저장 · 두 번 눌러 실행',
  simplify: '코드 다듬기',
}

/** 버튼마다 한 줄 설명을 곁들인다. 커밋은 한 번 누르면 5초 동안 "한 번 더"로 바뀐다. */
const quickSection = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const rows = QUICK.map(({ key, label }) => {
    const isArmed = key === 'commit' && d.isCommitArmed

    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        <Button key={key} label={isArmed ? `한 번 더: ${label}` : label} onPress={() => act.quick(key)} />
        <Text color={isArmed ? d.scene.accent : d.scene.muted} weight={isArmed ? 'semibold' : 'regular'} size="footnote">
          {isArmed ? '5초 안에 누르면 실행' : QUICK_NOTE[key]}
        </Text>
      </Box>
    )
  })

  return section(ui, d.scene, '빠른 실행', rows)
}

/** 한도 정보가 비어 있을 때 이유를 알려 주고, 막대가 무엇을 뜻하는지 늘 적어 둔다. */
const limitsNote = (ui: Ui, d: PanelData) => {
  const { Text } = ui
  const lines = ['막대는 지금까지 쓴 양이에요']

  if (d.usage === null) lines.push('첫 응답이 끝나면 채워져요')
  else if (d.usage.limits.length === 0) lines.push('아직 받은 한도 정보가 없어요')

  return lines.map(line => (
    <Text color={d.scene.muted} size="footnote">
      {line}
    </Text>
  ))
}

const limitsSection = (ui: Ui, d: PanelData) => {
  const { Svg } = ui

  return section(ui, d.scene, '사용량 한도', [
    <Svg
      source={limitsSvg(d.scene, d.usage, d.now)}
      alt="5시간 사용량과 주간 사용량"
      width={LIMITS_WIDTH}
      height={LIMITS_HEIGHT}
    />,
    ...limitsNote(ui, d),
  ])
}

/** git 저장소가 아니면 오류가 아니라 정보로 보여 준다. */
const gitRows = (ui: Ui, d: PanelData) => {
  const { Box, Text } = ui
  const { git, scene } = d

  if (git === null) {
    return [
      <Text color={scene.muted} size="footnote">
        ○ Git 저장소가 아니에요
      </Text>,
    ]
  }
  const sync = [git.ahead > 0 ? `올릴 커밋 ${git.ahead}` : '', git.behind > 0 ? `받을 커밋 ${git.behind}` : '']
  const hint = sync.filter(Boolean).join(' · ')

  return [
    <Box flexDirection="row" gap={2}>
      <Text weight="semibold">● {git.branch}</Text>
      <Text color={git.changed > 0 ? scene.accent : scene.muted}>
        {git.changed > 0 ? `변경 ${git.changed}개` : '변경 없음'}
      </Text>
    </Box>,
    ...(hint === '' ? [] : [<Text color={scene.muted} size="footnote">{hint}</Text>]),
    ...git.commits.map(c => (
      <Text color={scene.muted} size="caption" mono>
        {c.hash} {clip(c.subject, 38)}
      </Text>
    )),
  ]
}

const counter = (ui: Ui, d: PanelData, value: number, label: string) => {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column">
      <Text size="heading" weight="bold" color={d.scene.accent} tabular>
        {String(value)}
      </Text>
      <Text size="footnote" color={d.scene.muted}>
        {label}
      </Text>
    </Box>
  )
}

/** 프로젝트와 오늘의 활동을 한곳에: 이름, git 상태, 숫자 세 개. */
const statusSection = (ui: Ui, d: PanelData) => {
  const { Box, Text } = ui
  const t = d.today.date === todayKey(d.now) ? d.today : { ...d.today, prompts: 0, actions: 0, files: [] }

  return section(ui, d.scene, '작업 현황', [
    <Text weight="semibold" wrap="truncate-end">
      {d.project === '' ? '-' : d.project}
    </Text>,
    ...gitRows(ui, d),
    <Text color={d.scene.muted} size="footnote">
      오늘
    </Text>,
    <Box flexDirection="row" gap={3}>
      {counter(ui, d, t.prompts, '프롬프트')}
      {counter(ui, d, t.actions, '도구 실행')}
      {counter(ui, d, t.files.length, '수정 파일')}
    </Box>,
  ])
}

const filesSection = (ui: Ui, d: PanelData, act: Actions) => {
  const { Button, Text } = ui
  const recent = [...d.chatFiles].reverse()
  const rows = recent
    .slice(0, MAX_FILES)
    .map(path => <Button key={`file:${path}`} plain label={shortPath(path)} onPress={() => act.mentionFile(path)} />)
  const more = recent.length - MAX_FILES
  const empty = [<Text color={d.scene.muted}>아직 없어요</Text>]
  const hint = [
    <Text color={d.scene.muted} size="footnote">
      누르면 프롬프트에 @경로로 넣어 줘요
    </Text>,
  ]

  return section(ui, d.scene, '이 채팅에서 만진 파일', [
    ...(rows.length === 0 ? empty : rows),
    ...(more > 0 ? [<Text color={d.scene.muted}>외 {more}개</Text>] : []),
    ...(rows.length === 0 ? [] : hint),
  ])
}

// 위에서 아래로: 환경(장면·음악) → 작업 제어(빠른 실행·한도) → 작업 현황(프로젝트·파일).
export const panelView = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Svg } = ui
  const percent = d.usage?.percent ?? null

  return (
    <Box flexDirection="column" backgroundColor={d.scene.base} paddingBottom={1}>
      {pickers(ui, d, act)}
      <Box backgroundColor={d.scene.base} justifyContent="center">
        <Svg
          source={composeScene(ART[d.scene.id], percent)}
          alt={`${d.scene.title}: ${d.scene.motto}`}
          width={SCENE_WIDTH}
          height={SCENE_HEIGHT}
        />
      </Box>
      {musicSection(ui, d, act)}
      {quickSection(ui, d, act)}
      {limitsSection(ui, d)}
      {statusSection(ui, d)}
      {filesSection(ui, d, act)}
    </Box>
  )
}
