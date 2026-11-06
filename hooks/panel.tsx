import type { Elements } from 'claude-code'

import type { ProjectToday, QuickKey, Todo, Today, Work } from '../types'
import type { Actions } from './actions'
import { ART, composeScene } from './art'
import type { BannerData } from './banner'
import { diagBoard } from './diag'
import type { Frame } from './diag'
import { shortModel, shortPath, todayKey } from './format'
import { gitRows } from './gitrows'
import { STRIPE_COLUMNS, band, card, cardOf, chevron, header, inset, isFolded, mark, summary } from './layout'
import { music } from './music'
import { projectRows } from './projects'
import { quick } from './quick'
import { MODES } from './scenes'
import { stillSvg } from './still'
import { SPACE, chipOf } from './theme'
import type { Ui as CommonUi } from './theme'
import { todo } from './todo'
import { USAGE_HEIGHT, usageSummary, usageSvg, usageWidthFor } from './usage'

export type PanelData = BannerData & {
  radioNote: string
  openHelp: string
  isDiag: boolean
  frame: Frame
  today: Today
  projects: ProjectToday[]
  favorites: string[]
  stationTab: string
  todos: Todo[]
  chatFiles: string[]
  isFilesOpen: boolean
  isPickerOpen: boolean
  armedKey: QuickKey | null
  work: Work
  volume: number
  collapsed: string[]
}

type Ui = Elements['desktop']

/*
 * 위에서 아래로: 장면(히어로) → 음악 → 빠른 실행 → 할 일 → 사용량 → 작업 현황 → 만진 파일.
 * 음악은 그림 바로 아래: 장면과 방송이 짝(장면을 바꾸면 방송도 바뀐다)이라 한 묶음으로 보이게 한다.
 * 구역을 짜는 부품은 layout.tsx, 음악 구역은 music.tsx에 있다.
 *
 * 접기: 그림·음악·사용량·작업 현황·만진 파일은 머리글 왼쪽의 ▾/▸로 접고 편다(상태는 기억한다).
 * 접으면 머리글 한 줄만 남고, 오른쪽에 그 구역의 한 줄 요약이 보인다. 작업 현황의 커밋 로그는 따로 접는다(기본은 접힘).
 *
 * 글자 위계(4단계)
 *   머리글  body·semibold·강조색        구역의 이름
 *   주요    heading·semibold·밝은 글자   방송 이름, 프로젝트 이름 (실측: heading 15px은 body 14px보다 1px만 커서 굵기로 구분한다)
 *           title·bold·강조색           숫자 칸의 숫자 (실측 22px: 한눈에 들어와야 하는 값)
 *   보조    body/footnote·흐린 글자      상태, 안내
 *   메타    caption·흐린 글자           커밋 로그, 개수, 접었을 때의 요약
 * 구역 여섯(음악·빠른 실행·할 일·사용량·작업 현황·만진 파일)은 모두 같은 카드다: 바탕보다 한 단계 밝은 배경 + 왼쪽 강조 막대,
 * 카드 사이는 바탕이 비쳐 보이는 간격(layout.tsx의 card). 숫자 칸과 git 칩은 카드보다 한 단계 더 밝다. 위의 장면 고르기 줄과 그림은 카드가 아니라 바탕 위다.
 * 설명은 화면에 늘어놓지 않고 필요한 머리글 오른쪽의 "?"에 둔다(help.tsx).
 */
const FILES_COLLAPSED = 4 // 파일 목록의 기본 노출 수(전체 보기를 누르면 모두)
const SCENE_WIDTH = 340
const SCENE_HEIGHT = 296 // 그림은 74줄까지(칸 4배)

/**
 * 영역 1: 장면 고르기. `◀ 장면 이름 n/N ▶`로 한 장면씩 넘긴다(끝에서 처음으로 이어지고 배너의 ⟳와 같은 순서): 목록을 스크롤하지 않는다.
 * 아래 줄에 그림 접기·움직임 켬/끔과 "?"(배너 버튼까지 설명). 좁으면 버튼이 다음 줄로 내려간다.
 */
export const settings = (ui: CommonUi, d: PanelData, act: Actions, hasMotion = true) => {
  const { Box, Button, Text } = ui
  const ids = MODES.flatMap(entry => entry.scenes)

  return band(ui, d.scene.base, [
    inset(ui, [
      <Box flexDirection="row" alignItems="center" gap={SPACE.control}>
        <Button key="scene:prev" plain label="◀" onPress={() => act.moveScene(-1)} />
        <Box flexGrow={1}>
          <Text size="heading" weight="semibold" wrap="truncate-end">
            {d.scene.title}
          </Text>
        </Box>
        <Text color={d.scene.muted} size="caption">
          {`${ids.indexOf(d.scene.id) + 1}/${ids.length}`}
        </Text>
        <Button key="scene:next" plain label="▶" onPress={() => act.moveScene(1)} />
      </Box>,
      <Box flexDirection="row" alignItems="center" flexWrap="wrap" gap={SPACE.control}>
        <Button key="fold:art" plain label={isFolded(d, 'art') ? '그림 ▸' : '그림 ▾'} onPress={() => act.toggleSection('art')} />
        {hasMotion ? [<Button key="still" plain label={d.isStill ? '움직임 끔' : '움직임 켬'} onPress={() => act.toggleStill()} />] : []}
        {mark(ui, d, act, 'scene')}
      </Box>,
      ...cardOf(ui, d, 'scene'),
    ]),
  ])
}

/** 한도 정보가 비어 있을 때만 이유를 알려 준다. 원이 무엇을 뜻하는지는 "?"에 있다. */
const usageNotes = (ui: CommonUi, d: PanelData) => {
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

/** 영역 2: 사용량 카드. 컨텍스트·5시간 한도·주간 한도를 원 3개로 한 줄에. 접으면 한 줄 요약만 남는다. */
const usage = (ui: Ui, d: PanelData, act: Actions) => {
  const { Svg } = ui
  const width = usageWidthFor(d.frame.columns - STRIPE_COLUMNS) // 카드 막대를 뺀 폭에 맞춘다(그림은 앱에서 줄어들지 않는다)
  const folded = isFolded(d, 'usage')

  return card(ui, d, [
    inset(ui, [
      header(ui, d, {
        title: '사용량',
        lead: [chevron(ui, d, act, 'usage')],
        trailing: [folded ? summary(ui, d, usageSummary(d.scene, d.usage, d.now)) : mark(ui, d, act, 'usage')],
      }),
      ...(folded ? [] : cardOf(ui, d, 'usage')),
    ]),
    ...(folded
      ? []
      : [
          <Svg
            source={usageSvg(d.scene, d.usage, d.now, width)}
            alt="컨텍스트, 5시간 한도, 주간 한도 사용량. 원은 쓴 양이에요"
            width={width}
            height={USAGE_HEIGHT}
          />,
          ...usageNotes(ui, d),
        ]),
  ])
}

/** 숫자 칸: 모든 칸이 같은 폭을 나눠 쓰고, 숫자는 자릿수가 달라도 자리가 흔들리지 않는다(tabular). */
const counter = (ui: CommonUi, d: PanelData, value: number, label: string) => {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column" flexGrow={1} backgroundColor={chipOf(d.scene)} paddingX={SPACE.control} paddingY={SPACE.control}>
      <Text size="title" weight="bold" color={d.scene.accent} tabular>
        {String(value)}
      </Text>
      <Text size="caption" color={d.scene.muted}>
        {label}
      </Text>
    </Box>
  )
}

/** 접은 작업 현황의 한 줄 요약: 프로젝트 이름과 git 상태. */
const statusSummary = (d: PanelData): string => {
  const where = d.git === null ? 'Git 없음' : `${d.git.branch}${d.git.changed > 0 ? ` +${d.git.changed}` : ''}`

  return `${d.project === '' ? '-' : d.project} · ${where}`
}

/** 영역 3: 작업 현황. 프로젝트 이름(주요) · git 상태(칩) · 오늘 누적 숫자 세 칸. */
export const status = (ui: CommonUi, d: PanelData, act: Actions) => {
  const { Box, Text } = ui
  const t = d.today.date === todayKey(d.now) ? d.today : { ...d.today, prompts: 0, actions: 0, files: [] }
  const folded = isFolded(d, 'status')

  return card(ui, d, [
    inset(ui, [
      header(ui, d, {
        title: '작업 현황',
        lead: [chevron(ui, d, act, 'status')],
        trailing: [folded ? summary(ui, d, statusSummary(d)) : mark(ui, d, act, 'status')],
      }),
      ...(folded ? [] : cardOf(ui, d, 'status')),
    ]),
    ...(folded
      ? []
      : [
          inset(ui, [
            <Text size="heading" weight="semibold" wrap="truncate-end">
              {d.project === '' ? '-' : d.project}
            </Text>,
            ...(d.model === null
              ? []
              : [
                  <Text color={d.scene.muted} size="footnote" wrap="truncate-end">
                    {`모델 ${shortModel(d.model)} · effort ${d.effort ?? '-'}`}
                  </Text>,
                ]),
            ...gitRows(ui, d, act),
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
            ...projectRows(ui, d, act),
          ]),
        ]),
  ])
}

/**
 * 영역 4: 이 채팅에서 만진 파일(프로젝트의 상세). 기본은 최근 4개, "전체 보기"로 모두 펼친다.
 * 위 "수정 파일"(오늘 누적)과는 다른 값이라 제목과 개수에 "이 채팅"을 적는다. 길면 가로로 넘치지 않게 잘라 낸다.
 */
export const files = (ui: CommonUi, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const recent = [...d.chatFiles].reverse()
  const shown = d.isFilesOpen ? recent : recent.slice(0, FILES_COLLAPSED)
  const folded = isFolded(d, 'files')
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

  return card(ui, d, [
    inset(ui, [
      header(ui, d, {
        title: '이 채팅에서 만진 파일',
        lead: [chevron(ui, d, act, 'files')],
        trailing: [summary(ui, d, `이 채팅 ${recent.length}개`)],
        isSub: true,
      }),
    ]),
    ...(folded
      ? []
      : [
          inset(ui, [
            ...(rows.length === 0 ? [<Text color={d.scene.muted}>아직 없어요</Text>] : [...hint, ...rows]),
            ...toggle,
          ]),
        ]),
  ])
}

export const panelView = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Svg } = ui
  const percent = d.usage?.percent ?? null

  return (
    <Box flexDirection="column" backgroundColor={d.scene.base} paddingBottom={SPACE.band} gap={SPACE.band}>
      {d.isDiag ? [diagBoard(ui, { scene: d.scene, frame: d.frame })] : []}
      <Box flexDirection="column">
        {settings(ui, d, act)}
        {isFolded(d, 'art')
          ? []
          : [
              <Box backgroundColor={d.scene.base} justifyContent="center">
                <Svg
                  source={stillSvg(composeScene(ART[d.scene.id], percent), d.isStill)}
                  alt={`${d.scene.title}: ${d.scene.motto}`}
                  width={SCENE_WIDTH}
                  height={SCENE_HEIGHT}
                />
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
