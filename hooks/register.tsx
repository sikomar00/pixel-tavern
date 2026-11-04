import type { Elements, EngineInterface, Register } from 'claude-code'

import { makeActions } from './actions'
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
    await $.command.register({ name: 'tavern', description: '픽셀 여관 패널을 엽니다' })

    void refresh($).catch(error => logFailure($, error))
    $.clock.every(REFRESH_MS, () => void refresh($).catch(error => logFailure($, error)))
    if (await takeIntro($)) $.ui.toast(INTRO)

    return next(e)
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

  on('tool.call', async ($, e, next) => {
    await countAction($)

    return next(e)
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
            <Button key="music" plain label={RADIO_ICON[data.radio]} onPress={() => makeActions($).toggleRadio()} />
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
    const view = { ...(await readView($)), ...(await readPanel($)) }

    return panelView(ui as Elements['desktop'], view, makeActions($))
  })
}
