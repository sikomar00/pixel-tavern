import type { RadioState } from '../types'
import type { Actions } from './actions'
import { card, cardOf, chevron, header, inset, isFolded, mark, summary } from './layout'
import type { PanelData } from './panel'
import { STATION_GROUPS } from './scenes'
import { FAVORITES_TAB, stationsIn, tabOf } from './stations'
import { WARN_COLOR } from './svg'
import { SPACE } from './theme'
import type { Ui } from './theme'
import { MAX_VOLUME } from './volume'

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
 * 방송 고르기(펼쳤을 때만, 장면마다 따로 기억한다): 묶음 버튼(★ 즐겨찾기 · 잔잔 · 7080 · 게임 · 신스) 한 줄과, 보고 있는 묶음의 방송 버튼들.
 * 지금 방송은 진한 버튼이고, 즐겨찾기한 방송은 이름 앞에 ★가 붙는다. 한 번에 한 묶음만 보여 버튼이 많지 않다(스크롤이 없다).
 */
const stationPicker = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const current = d.scene.music
  const tab = tabOf(d.stationTab, current)
  const shown = stationsIn(tab, d.favorites)
  const tabs = [{ id: FAVORITES_TAB, label: '★' }, ...STATION_GROUPS]

  return [
    <Box flexDirection="row" flexWrap="wrap" gap={SPACE.control}>
      {tabs.map(entry => (
        <Button key={`group:${entry.id}`} variant={entry.id === tab ? 'primary' : 'secondary'} label={entry.label} onPress={() => act.showGroup(entry.id)} />
      ))}
    </Box>,
    ...(shown.length === 0
      ? [
          <Text color={d.scene.muted} size="caption">
            즐겨찾기한 방송이 없어요. 방송을 고르고 ☆ 즐겨찾기를 누르세요
          </Text>,
        ]
      : [
          <Box flexDirection="row" flexWrap="wrap" gap={SPACE.control}>
            {shown.map(station => (
              <Button
                key={`station:${station.id}`}
                variant={station.id === current.id ? 'primary' : 'secondary'}
                label={`${d.favorites.includes(station.id) ? '★ ' : ''}${station.short}`}
                onPress={() => act.setStation(station.id)}
              />
            ))}
          </Box>,
        ]),
  ]
}

/** 방송 이름(주요)과 상태(보조: 꺼짐·연결 중·재생 중·연결 실패)를 한 줄에, 실패·다시 연결하는 이유는 그 아래 한 줄. 좁으면 이름이 잘리고 상태는 줄지 않는다. */
const nowPlaying = (ui: Ui, d: PanelData) => {
  const { Box, Text } = ui
  const isRunning = d.radio === 'connecting' || d.radio === 'playing'
  const isFailed = d.radio === 'failed'

  return [
    <Box flexDirection="row" alignItems="center" gap={SPACE.control}>
      <Box flexGrow={1}>
        <Text size="heading" weight="semibold" wrap="truncate-end">
          {d.scene.music.label}
        </Text>
      </Box>
      <Box flexShrink={0}>
        <Text color={isFailed ? WARN_COLOR : isRunning ? d.scene.accent : d.scene.muted} weight="semibold" size="footnote">
          {RADIO_STATUS[d.radio]}
        </Text>
      </Box>
    </Box>,
    ...(d.radio === 'playing' && d.songTitle !== ''
      ? [
          <Text color={d.scene.accent} size="footnote" wrap="truncate-end">
            {`♪ ${d.songTitle}`}
          </Text>,
        ]
      : []),
    ...((isFailed || d.radio === 'connecting') && d.radioNote !== ''
      ? [
          <Text color={d.scene.muted} size="caption">
            {d.radioNote}
          </Text>,
        ]
      : []),
  ]
}

/**
 * 영역 5: 음악 플레이어. 평소에는 세 줄: ① 방송 이름과 상태(소리가 나오는 중이고 곡 제목을 알면 그 아래에 `♪ 제목` 한 줄) ② 재생·정지와 음량 ③ "방송 바꾸기"와 "즐겨찾기".
 * 방송 고르기(묶음 버튼 + 방송 버튼)는 "방송 바꾸기"를 눌러야 펼쳐진다. 실패하면 이유가 한 줄 붙고 버튼이 "다시 시도"가 된다
 * (다시 연결하는 중에도 몇 번째 시도인지 한 줄 붙는다). 구역을 접으면 상태 한 줄만 남는다(배너 ▶/■로 계속 조작할 수 있다).
 */
export const music = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Text } = ui
  const isRunning = d.radio === 'connecting' || d.radio === 'playing'
  const label = isRunning ? '■ 정지' : d.radio === 'failed' ? '▶ 다시 시도' : d.radio === 'other' ? '▶ 여기서 켜기' : '▶ 재생'
  const folded = isFolded(d, 'music')

  // 윈도우가 아니면 음악은 쓸 수 없다: 버튼을 두지 않고 이유만 알린다.
  if (!d.isMusicAvailable) {
    return card(ui, d, [
      inset(ui, [
        header(ui, d, { title: '음악' }),
        <Text color={d.scene.muted} size="footnote">
          음악은 Windows에서만 쓸 수 있어요
        </Text>,
      ]),
    ])
  }

  return card(ui, d, [
    inset(ui, [
      header(ui, d, {
        title: '음악',
        lead: [chevron(ui, d, act, 'music')],
        trailing: [folded ? summary(ui, d, RADIO_STATUS[d.radio]) : mark(ui, d, act, 'music')],
      }),
      ...(folded ? [] : cardOf(ui, d, 'music')),
    ]),
    ...(folded
      ? []
      : [
          inset(
            ui,
            [
              ...nowPlaying(ui, d),
              <Box flexDirection="row" alignItems="center" gap={SPACE.control} flexWrap="wrap">
                <Button key="radio" variant={isRunning ? 'secondary' : 'primary'} label={label} onPress={() => act.toggleRadio()} />
                {volumeControls(ui, d, act)}
              </Box>,
            ],
            SPACE.control,
          ),
          inset(ui, [
            <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={SPACE.control}>
              <Button key="picker" plain label={d.isPickerOpen ? '▾ 방송 바꾸기' : '▸ 방송 바꾸기'} onPress={() => act.togglePicker()} />
              <Button key="favorite" plain label={d.favorites.includes(d.scene.music.id) ? '★ 즐겨찾기' : '☆ 즐겨찾기'} onPress={() => act.toggleFavorite(d.scene.music.id)} />
            </Box>,
            ...(d.isPickerOpen ? stationPicker(ui, d, act) : []),
          ], SPACE.control),
        ]),
  ])
}
