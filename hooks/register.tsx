import type { Elements, EngineInterface, Register } from 'claude-code'

import { makeActions } from './actions'
import { detectMusic } from './radio'
import { RADIO_ICON, bannerText, bannerView } from './banner'
import { baseName } from './format'
import { panelView } from './panel'
import {
  countAction,
  countPrompt,
  loadStored,
  readHidden,
  readPanel,
  readView,
  refresh,
  refreshGit,
  takeIntro,
  toUsage,
  trackFile,
  writeProject,
  writeRadio,
  writeUsage,
} from './state'

const REFRESH_MS = 60_000

const isRich = (surface: string): boolean => surface === 'desktop' || surface === 'vscode'

const INTRO = '픽셀 여관이 열렸어요. 오른쪽 위 버튼: ▶ 음악 · ▤ 패널 · ⟳ 장면 바꾸기 · ✕ 숨기기'

const logFailure = ($: EngineInterface, error: unknown) =>
  $.ui.log(`pixel-tavern: refresh failed: ${String(error)}`, { to: 'debug' })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await loadStored($)
    await writeProject($, baseName(e.cwd))
    await writeRadio($, 'off') // 다시 불러오면 재생기 프로세스는 이미 끝나 있다
    await detectMusic($)
    await $.command.register({ name: 'tavern', description: '픽셀 여관 패널을 엽니다' })
    await $.command.register({ name: 'tavern-diag', description: '패널의 실제 폭·간격·글자 크기를 재는 측정판을 켜고 끕니다' })

    void refresh($).catch(error => logFailure($, error))
    $.clock.every(REFRESH_MS, () => void refresh($).catch(error => logFailure($, error)))
    if (await takeIntro($)) $.ui.toast(INTRO)

    return next(e)
  })

  // 측정판: 앱에서 패널을 캡처해 보내면 실제 폭·간격·글자 크기를 알 수 있다(화면 설계를 추정이 아니라 숫자로 하려는 용도).
  on('command.run', { command: 'tavern-diag' }, async $ => {
    const actions = makeActions($)
    const isOn = await actions.toggleDiag()

    await actions.openPanel()

    return { text: isOn ? '측정판을 켰어요. 패널 맨 위를 캡처해 보내 주세요. 끄려면 /tavern-diag 를 다시 입력해요.' : '측정판을 껐어요.' }
  })

  on('command.run', { command: 'tavern' }, async $ => {
    await makeActions($).openPanel()

    return { text: '여관 패널을 열었어요.' }
  })

  on('session.measure', async ($, e, next) => {
    await writeUsage($, toUsage(e))
    void refreshGit($).catch(error => logFailure($, error)) // 한 턴이 끝났으니 파일이 바뀌었을 수 있다

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await countPrompt($)

    return next(e)
  })

  // "도구 실행"은 거부되거나 실패하지 않고 끝난 호출만 센다.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true) await countAction($)

    return ran
  })

  for (const tool of ['Edit', 'Write'] as const) {
    on('tool.call', { tool }, async ($, e, next) => {
      const ran = await next(e)

      if (ran.deny === undefined && ran.isError !== true && typeof e.file_path === 'string') {
        await trackFile($, e.file_path)
      }

      return ran
    })
  }

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true && typeof e.notebook_path === 'string') await trackFile($, e.notebook_path)

    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const own = await next(e)

    if (e.props.hasSurvey) return own
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const data = await readView($)

    if (!isRich(e.surface)) {
      return (
        <Box flexDirection="column">
          {own}
          <Box flexDirection="row" gap={1}>
            <Text dimColor>{bannerText(data)}</Text>
            {data.isMusicAvailable
              ? [<Button key="music" plain label={RADIO_ICON[data.radio]} onPress={() => makeActions($).toggleRadio()} />]
              : []}
          </Box>
        </Box>
      )
    }
    const hidden = await readHidden($)

    return (
      <Box flexDirection="column">
        {own}
        {bannerView(ui as Elements['desktop'], { ...data, isHidden: hidden }, makeActions($))}
      </Box>
    )
  })

  // 검사가 읽을 수 있게 매처는 글자 그대로 쓴다(actions.ts의 PANE_ID와 같은 값).
  on('ui.render', { component: 'Pane', requestId: 'tavern' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui

    if (!isRich(e.surface)) {
      return (
        <Box>
          <Text>여관 패널은 데스크톱 앱에서만 볼 수 있어요.</Text>
        </Box>
      )
    }
    const frame = { columns: e.props.bodyColumns, rows: e.props.scroll.bodyRows, placement: e.props.placement, surface: e.surface }
    const view = { ...(await readView($)), ...(await readPanel($)), frame }

    return panelView(ui as Elements['desktop'], view, makeActions($))
  })
}
