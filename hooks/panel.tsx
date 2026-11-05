import type { Elements } from 'claude-code'

import type { RadioState, SceneId, Today } from '../types'
import { QUICK } from './actions'
import type { Actions } from './actions'
import { ART, composeScene } from './art'
import type { BannerData } from './banner'
import { shortPath, todayKey } from './format'
import { helpCard, helpMark } from './help'
import type { HelpId } from './help'
import { MODES, SCENES } from './scenes'
import { WARN_COLOR, clip } from './svg'
import { SPACE, chipOf, surfaceOf } from './theme'
import type { Gap } from './theme'
import { USAGE_HEIGHT, USAGE_WIDTH, usageSvg } from './usage'
import { MAX_VOLUME } from './volume'

export type PanelData = BannerData & {
  radioNote: string
  openHelp: string
  today: Today
  chatFiles: string[]
  isFilesOpen: boolean
  isCommitArmed: boolean
  volume: number
}

type Ui = Elements['desktop']

/*
 * 위에서 아래로: 장면(히어로) → 빠른 실행 → 사용량 → 작업 현황 → 만진 파일 → 음악.
 * 자주 쓰는 것(실행·사용량)이 위에 오고, 음악은 배너의 ▶/■로 늘 켜고 끌 수 있어서 맨 아래에 둔다.
 *
 * 글자 위계(4단계)
 *   머리글  body·semibold·강조색        구역의 이름
 *   주요    heading·semibold·밝은 글자   방송 이름, 프로젝트 이름, 숫자
 *   보조    body/footnote·흐린 글자      상태, 안내
 *   메타    caption·흐린 글자           커밋 로그, 개수
 * 카드(바탕보다 한 단계 밝은 배경)는 데이터를 담는 사용량과 만진 파일 목록에만 쓴다. 나머지는 바탕 위의 띠다.
 * 설명은 화면에 늘어놓지 않고 필요한 머리글 오른쪽의 "?"에 둔다(help.tsx).
 */
const FILES_COLLAPSED = 4 // 파일 목록의 기본 노출 수(전체 보기를 누르면 모두)
const SCENE_WIDTH = 340
const SCENE_HEIGHT = 296 // 그림은 74줄까지(칸 4배)

/** 구역: 전체 폭, 위아래 여백. 안쪽 좌우 여백은 inset이 만든다(전체 폭 그림은 그 바깥에 둔다). */
const band = (ui: Ui, background: string, children: unknown[]) => {
  const { Box } = ui

  return (
    <Box flexDirection="column" backgroundColor={background} paddingY={SPACE.band} gap={SPACE.stack}>
      {children}
    </Box>
  )
}

const inset = (ui: Ui, children: unknown[], gap: Gap = SPACE.line) => {
  const { Box } = ui

  return (
    <Box flexDirection="column" paddingX={SPACE.edge} gap={gap}>
      {children}
    </Box>
  )
}

/** 항목의 "?" 표시. 이 항목의 설명이 펼쳐져 있으면 "×"가 된다. */
const mark = (ui: Ui, d: PanelData, act: Actions, id: HelpId) =>
  helpMark(ui, { scene: d.scene, act, id, isOpen: d.openHelp === id })

/** 펼쳐진 설명(열려 있을 때만). 머리글 아래 안쪽 여백 목록에 이어 붙인다. */
const cardOf = (ui: Ui, d: PanelData, id: HelpId): unknown[] => (d.openHelp === id ? [helpCard(ui, { scene: d.scene, id })] : [])

/** 제목 줄: 왼쪽은 제목, 오른쪽은 개수·"?" 같은 덧붙임. */
const titleRow = (ui: Ui, title: unknown, trailing: unknown[]) => {
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

/** 머리글: 구역의 이름. */
const header = (ui: Ui, d: PanelData, title: string, trailing: unknown[] = []) => {
  const { Text } = ui

  return titleRow(
    ui,
    <Text color={d.scene.accent} weight="semibold">
      {title}
    </Text>,
    trailing,
  )
}

/** 소제목: 구역 안의 한 단계 아래 묶음(프로젝트의 파일 목록). 머리글보다 조용하다. */
const subheader = (ui: Ui, d: PanelData, title: string, trailing: unknown[] = []) => {
  const { Text } = ui

  return titleRow(
    ui,
    <Text color={d.scene.muted} weight="semibold" size="footnote">
      {title}
    </Text>,
    trailing,
  )
}

/** 영역 1: 장면 선택. 테마는 4개뿐이라 모드 없이 하나로 고른다. 오른쪽 "?"는 배너 버튼까지 설명한다. */
const settings = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Select } = ui
  const ids = MODES.flatMap(entry => entry.scenes)

  return band(ui, d.scene.base, [
    inset(ui, [
      <Box flexDirection="row" alignItems="center" gap={SPACE.control}>
        <Box flexGrow={1}>
          <Select
            key="scene"
            label="장면"
            options={ids.map(id => ({ value: id, label: SCENES[id].title }))}
            value={d.scene.id}
            onSelect={value => act.setScene(value as SceneId)}
          />
        </Box>
        {mark(ui, d, act, 'scene')}
      </Box>,
      ...cardOf(ui, d, 'scene'),
    ]),
  ])
}

/** 영역 2: 빠른 실행. 버튼만 한 줄에 둔다. 커밋을 한 번 누르면 5초 동안 "한 번 더"로 바뀌고 안내가 붙는다. */
const quick = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const buttons = QUICK.map(({ key, label }) => {
    const isArmed = key === 'commit' && d.isCommitArmed

    return (
      <Button
        key={key}
        variant={isArmed ? 'primary' : undefined}
        label={isArmed ? '한 번 더' : label} // 라벨 길이가 같아야 줄이 흔들리지 않는다
        onPress={() => act.quick(key)}
      />
    )
  })
  const armed = [
    <Text color={d.scene.accent} weight="semibold" size="footnote">
      5초 안에 한 번 더 누르면 변경을 커밋해요
    </Text>,
  ]

  return band(ui, d.scene.base, [
    inset(ui, [header(ui, d, '빠른 실행', [mark(ui, d, act, 'quick')]), ...cardOf(ui, d, 'quick')]),
    inset(
      ui,
      [
        <Box flexDirection="row" gap={SPACE.control} flexWrap="wrap">
          {buttons}
        </Box>,
        ...(d.isCommitArmed ? armed : []),
      ],
      SPACE.control,
    ),
  ])
}

/** 한도 정보가 비어 있을 때만 이유를 알려 준다. 원이 무엇을 뜻하는지는 "?"에 있다. */
const usageNotes = (ui: Ui, d: PanelData) => {
  const { Text } = ui
  const note =
    d.usage === null ? '첫 응답이 끝나면 채워져요' : d.usage.limits.length === 0 ? '아직 받은 한도 정보가 없어요' : ''

  return note === ''
    ? []
    : [
        inset(ui, [
          <Text color={d.scene.muted} size="caption">
            {note}
          </Text>,
        ]),
      ]
}

/** 영역 2: 사용량 카드. 컨텍스트·5시간 한도·주간 한도를 원 3개로 한 줄에. 그림은 전체 폭으로 그려서 글자가 줄어들지 않게 한다. */
const usage = (ui: Ui, d: PanelData, act: Actions) => {
  const { Svg } = ui

  return band(ui, surfaceOf(d.scene), [
    inset(ui, [header(ui, d, '사용량', [mark(ui, d, act, 'usage')]), ...cardOf(ui, d, 'usage')]),
    <Svg
      source={usageSvg(d.scene, d.usage, d.now)}
      alt="컨텍스트, 5시간 한도, 주간 한도 사용량. 원은 쓴 양이에요"
      width={USAGE_WIDTH}
      height={USAGE_HEIGHT}
    />,
    ...usageNotes(ui, d),
  ])
}

/** 칩: 상태 하나를 작은 배경 위에 올린다. */
const chip = (ui: Ui, d: PanelData, child: unknown) => {
  const { Box } = ui

  return (
    <Box backgroundColor={chipOf(d.scene)} paddingX={SPACE.control} paddingY={SPACE.line}>
      {child}
    </Box>
  )
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
    <Box flexDirection="row" gap={SPACE.control} flexWrap="wrap">
      {chip(ui, d, <Text weight="semibold">{git.branch}</Text>)}
      {chip(
        ui,
        d,
        // 강조색은 글자가 아니라 점에만 쓴다: 칩 배경 위에서 강조색 글자는 대비가 모자라다.
        <Box flexDirection="row" gap={SPACE.line}>
          <Text color={git.changed > 0 ? scene.accent : scene.muted}>●</Text>
          <Text>{git.changed > 0 ? `변경 ${git.changed}개` : '변경 없음'}</Text>
        </Box>,
      )}
    </Box>,
    ...(hint === ''
      ? []
      : [
          <Text color={scene.muted} size="footnote">
            {hint}
          </Text>,
        ]),
    ...git.commits.map(c => (
      <Text color={scene.muted} size="caption" mono>
        {c.hash} {clip(c.subject, 38)}
      </Text>
    )),
  ]
}

/** 숫자 칸: 모든 칸이 같은 폭을 나눠 쓰고, 숫자는 자릿수가 달라도 자리가 흔들리지 않는다(tabular). */
const counter = (ui: Ui, d: PanelData, value: number, label: string) => {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column" flexGrow={1} backgroundColor={surfaceOf(d.scene)} paddingX={SPACE.control} paddingY={SPACE.control}>
      <Text size="heading" weight="bold" color={d.scene.accent} tabular>
        {String(value)}
      </Text>
      <Text size="caption" color={d.scene.muted}>
        {label}
      </Text>
    </Box>
  )
}

/** 영역 3: 작업 현황. 프로젝트 이름(주요) · git 상태(칩) · 오늘 누적 숫자 세 칸. */
const status = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Text } = ui
  const t = d.today.date === todayKey(d.now) ? d.today : { ...d.today, prompts: 0, actions: 0, files: [] }

  return band(ui, d.scene.base, [
    inset(ui, [header(ui, d, '작업 현황', [mark(ui, d, act, 'status')]), ...cardOf(ui, d, 'status')]),
    inset(ui, [
      <Text size="heading" weight="semibold" wrap="truncate-end">
        {d.project === '' ? '-' : d.project}
      </Text>,
      ...gitRows(ui, d),
    ]),
    inset(ui, [
      <Text color={d.scene.muted} size="caption">
        오늘 누적
      </Text>,
      <Box flexDirection="row" gap={SPACE.control} flexWrap="wrap">
        {counter(ui, d, t.prompts, '프롬프트')}
        {counter(ui, d, t.actions, '도구 실행')}
        {counter(ui, d, t.files.length, '수정 파일')}
      </Box>,
    ]),
  ])
}

/**
 * 영역 4: 이 채팅에서 만진 파일(프로젝트의 상세). 기본은 최근 4개, "전체 보기"로 모두 펼친다.
 * 위 "수정 파일"(오늘 누적)과는 다른 값이라 제목과 개수에 "이 채팅"을 적는다. 길면 가로로 넘치지 않게 잘라 낸다.
 */
const files = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const recent = [...d.chatFiles].reverse()
  const shown = d.isFilesOpen ? recent : recent.slice(0, FILES_COLLAPSED)
  const rows = shown.map(path => (
    <Box overflow="hidden">
      <Button key={`file:${path}`} plain label={shortPath(path)} onPress={() => act.mentionFile(path)} />
    </Box>
  ))
  const toggle =
    recent.length > FILES_COLLAPSED
      ? [<Button key="files-toggle" plain label={d.isFilesOpen ? '접기' : `전체 보기 (${recent.length})`} onPress={() => act.toggleFiles()} />]
      : []
  const hint = [
    <Text color={d.scene.muted} size="caption">
      누르면 프롬프트에 @경로로 들어가요
    </Text>,
  ]

  return band(ui, surfaceOf(d.scene), [
    inset(ui, [
      subheader(ui, d, '이 채팅에서 만진 파일', [
        <Text color={d.scene.muted} size="caption">
          {`이 채팅 ${recent.length}개`}
        </Text>,
      ]),
    ]),
    inset(ui, [
      ...(rows.length === 0 ? [<Text color={d.scene.muted}>아직 없어요</Text>] : [...hint, ...rows]),
      ...toggle,
    ]),
  ])
}

const RADIO_STATUS: Record<RadioState, string> = {
  off: '○ 멈춤',
  connecting: '◌ 연결 중…',
  playing: '● 재생 중',
  failed: '✕ 연결 실패',
  other: '◇ 다른 채팅에서 재생 중',
}

/** 음량 −/+ 와 현재 단계(●가 채운 칸). 켜져 있으면 새 음량으로 방송을 다시 연결한다. */
const volumeControls = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const bars = '●'.repeat(d.volume) + '○'.repeat(MAX_VOLUME - d.volume)

  return (
    <Box flexDirection="row" alignItems="center" gap={SPACE.control}>
      <Text color={d.scene.muted} size="footnote">
        음량
      </Text>
      <Button key="volume-down" label="−" onPress={() => act.setVolume(d.volume - 1)} />
      <Text>{bars}</Text>
      <Button key="volume-up" label="+" onPress={() => act.setVolume(d.volume + 1)} />
    </Box>
  )
}

/**
 * 영역 5: 음악 플레이어. 방송 이름(주요) · 상태(보조: 꺼짐/연결 중/재생 중/연결 실패) · 조작(재생·정지, 음량).
 * 실패하면 이유가 한 줄 붙고 버튼이 "다시 시도"가 된다.
 */
const music = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const isRunning = d.radio === 'connecting' || d.radio === 'playing'
  const isFailed = d.radio === 'failed'
  const label = isRunning ? '■ 정지' : isFailed ? '▶ 다시 시도' : d.radio === 'other' ? '▶ 여기서 켜기' : '▶ 재생'

  // 윈도우가 아니면 음악은 쓸 수 없다: 버튼을 두지 않고 이유만 알린다.
  if (!d.isMusicAvailable) {
    return band(ui, d.scene.base, [
      inset(ui, [
        header(ui, d, '음악'),
        <Text color={d.scene.muted} size="footnote">
          음악은 Windows에서만 쓸 수 있어요
        </Text>,
      ]),
    ])
  }

  return band(ui, d.scene.base, [
    inset(ui, [header(ui, d, '음악', [mark(ui, d, act, 'music')]), ...cardOf(ui, d, 'music')]),
    inset(ui, [
      <Text size="heading" weight="semibold" wrap="truncate-end">
        {d.scene.music.label}
      </Text>,
      <Text color={isFailed ? WARN_COLOR : isRunning ? d.scene.accent : d.scene.muted} weight="semibold" size="footnote">
        {RADIO_STATUS[d.radio]}
      </Text>,
      ...(isFailed && d.radioNote !== ''
        ? [
            <Text color={d.scene.muted} size="caption">
              {d.radioNote}
            </Text>,
          ]
        : []),
    ]),
    inset(ui, [
      <Box flexDirection="row" alignItems="center" gap={SPACE.control} flexWrap="wrap">
        <Button key="radio" variant={isRunning ? 'secondary' : 'primary'} label={label} onPress={() => act.toggleRadio()} />
        {volumeControls(ui, d, act)}
      </Box>,
    ]),
  ])
}

export const panelView = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Svg } = ui
  const percent = d.usage?.percent ?? null

  return (
    <Box flexDirection="column" backgroundColor={d.scene.base} paddingBottom={SPACE.band}>
      {settings(ui, d, act)}
      <Box backgroundColor={d.scene.base} justifyContent="center">
        <Svg
          source={composeScene(ART[d.scene.id], percent)}
          alt={`${d.scene.title}: ${d.scene.motto}`}
          width={SCENE_WIDTH}
          height={SCENE_HEIGHT}
        />
      </Box>
      {quick(ui, d, act)}
      {usage(ui, d, act)}
      {status(ui, d, act)}
      {files(ui, d, act)}
      {music(ui, d, act)}
    </Box>
  )
}
