import type { Elements } from 'claude-code'

import type { ModeId, Mood, RadioState, SceneId, Today } from '../types'
import { QUICK } from './actions'
import type { Actions } from './actions'
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

const MAX_FILES = 8
const SCENE_WIDTH = 340
const SCENE_HEIGHT = 384

/** 제목이 붙은 구역. 배경은 장면 색이라 그림 아래까지 색이 이어진다. */
const section = (ui: Ui, scene: Scene, title: string, children: unknown[]) => {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column" backgroundColor={scene.base} paddingX={1} paddingTop={1}>
      <Text color={scene.accent} weight="bold" size="footnote">
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

const projectSection = (ui: Ui, d: PanelData) => {
  const { Text } = ui
  const { git, scene } = d
  const rows =
    git === null
      ? [<Text color={scene.muted}>git 저장소가 아닙니다</Text>]
      : [
          <Text color={scene.muted}>브랜치 {git.branch}</Text>,
          <Text color={scene.muted}>
            {git.changed > 0 ? `변경 ${git.changed}개` : '변경 없음'} · 앞섬 {git.ahead} · 뒤처짐 {git.behind}
          </Text>,
          ...git.commits.map(c => (
            <Text color={scene.muted} mono>
              {c.hash} {clip(c.subject, 38)}
            </Text>
          )),
        ]

  return section(ui, scene, '프로젝트', [<Text weight="bold">{d.project === '' ? '-' : d.project}</Text>, ...rows])
}

const todaySection = (ui: Ui, d: PanelData) => {
  const { Box, Text } = ui
  const t = d.today.date === todayKey(d.now) ? d.today : { ...d.today, prompts: 0, actions: 0, files: [] }

  return section(ui, d.scene, '오늘', [
    <Box flexDirection="row" gap={2}>
      <Text>프롬프트 {t.prompts}</Text>
      <Text>도구 실행 {t.actions}</Text>
      <Text>건드린 파일 {t.files.length}</Text>
    </Box>,
  ])
}

const RADIO_STATUS: Record<RadioState, string> = { off: '멈춤', connecting: '연결 중…', playing: '재생 중' }

/** 음량 −/+ 와 현재 단계(●가 채운 칸). 켜져 있으면 새 음량으로 방송을 다시 연결한다. */
const volumeRow = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const bars = '●'.repeat(d.volume) + '○'.repeat(MAX_VOLUME - d.volume)

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={d.scene.muted}>음량</Text>
      <Button key="volume-down" label="−" onPress={() => act.setVolume(d.volume - 1)} />
      <Text>{bars}</Text>
      <Button key="volume-up" label="+" onPress={() => act.setVolume(d.volume + 1)} />
    </Box>
  )
}

const musicSection = (ui: Ui, d: PanelData, act: Actions) => {
  const { Button, Text } = ui

  return section(ui, d.scene, '음악', [
    <Text weight="bold">{d.scene.music.label}</Text>,
    <Text color={d.scene.muted}>24시간 인터넷 라디오 · {RADIO_STATUS[d.radio]}</Text>,
    <Button key="radio" label={d.radio === 'off' ? '▶ 재생' : '■ 정지'} onPress={() => act.toggleRadio()} />,
    volumeRow(ui, d, act),
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

const quickSection = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const buttons = QUICK.map(({ key, label }) => (
    <Button
      key={key}
      label={key === 'commit' && d.isCommitArmed ? `한 번 더: ${label}` : label}
      onPress={() => act.quick(key)}
    />
  ))
  const caution = d.isCommitArmed ? '5초 안에 한 번 더 누르면 커밋해요' : '커밋은 두 번 눌러야 실행돼요'

  return section(ui, d.scene, '빠른 실행', [
    <Box flexDirection="row" gap={1}>
      {buttons}
    </Box>,
    <Text color={d.scene.muted} size="footnote">
      리뷰=검토 · 커밋=저장 · 정리=다듬기
    </Text>,
    <Text color={d.scene.muted} size="footnote">
      {caution}
    </Text>,
  ])
}

/** 한도 정보가 비어 있을 때만 이유를 알려 준다. */
const limitsNote = (ui: Ui, d: PanelData) => {
  const { Text } = ui

  if (d.usage !== null && d.usage.limits.length > 0) return []
  const why = d.usage === null ? '첫 응답이 끝나면 채워져요' : '아직 받은 한도 정보가 없어요'

  return [
    <Text color={d.scene.muted} size="footnote">
      {why}
    </Text>,
  ]
}

const limitsSection = (ui: Ui, d: PanelData) => {
  const { Svg } = ui

  return section(ui, d.scene, '한도', [
    <Svg
      source={limitsSvg(d.scene, d.usage, d.now)}
      alt="5시간 한도와 주간 한도"
      width={LIMITS_WIDTH}
      height={LIMITS_HEIGHT}
    />,
    ...limitsNote(ui, d),
  ])
}

// 자주 누르는 것(음악·빠른 실행)을 그림 바로 아래에 둬서 스크롤 없이 닿게 한다.
export const panelView = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Svg } = ui
  const percent = d.usage?.percent ?? null

  return (
    <Box flexDirection="column" backgroundColor={d.scene.base}>
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
      {projectSection(ui, d)}
      {todaySection(ui, d)}
      {filesSection(ui, d, act)}
    </Box>
  )
}
