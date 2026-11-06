import type { Elements, EngineInterface, Register } from 'claude-code'

import { makeActions } from './actions'
import { NO_ALERTS, checkAlerts } from './alerts'
import type { Alerted } from './alerts'
import { detectMusic } from './radio'
import { RADIO_ICON, bannerText, bannerView } from './banner'
import { baseName } from './format'
import { panelView } from './panel'
import {
  loadStored,
  noteStep,
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
import { countAction, countPrompt, readProjects, readToday } from './stats'
import { flashReaction, noteTestRun, reactionOfTurn } from './reaction'
import { readFavorites, readStationTab } from './stations'
import { readStreak, recordWorkDay } from './streak'
import { TERMINAL_BANNER_ROWS, termBanner, termPanelView } from './term'
import { noteTurnFile, readTimeline, recordPrompt, recordTurnEnd, resetTurnFiles } from './timeline'
import { readTodos } from './todos'
import { beginTurn, endTurn, readWork } from './work'

const REFRESH_MS = 60_000

const isRich = (surface: string): boolean => surface === 'desktop' || surface === 'vscode'

const INTRO = '픽셀 여관이 열렸어요. 오른쪽 위 버튼: ▶ 음악 · ▤ 패널 · ⟳ 장면 바꾸기 · ✕ 숨기기'

const logFailure = ($: EngineInterface, error: unknown) =>
  $.ui.log(`pixel-tavern: refresh failed: ${String(error)}`, { to: 'debug' })

const ALERT_MS = 8000

/** 거부되거나 실패하지 않고 끝난 호출의 파일만 기록한다. 엔진의 검사 때문에 `$`를 받는 함수는 파일 맨 위에 둔다. */
const trackIfDone = async ($: EngineInterface, ran: { deny?: unknown; isError?: boolean }, path: unknown): Promise<void> => {
  if (ran.deny === undefined && ran.isError !== true && typeof path === 'string') {
    await trackFile($, path)
    noteTurnFile(path) // 이 턴에 고친 파일 수(지문으로 메모리에만)
  }
}

export const register: Register = on => {
  let alerted: Alerted = NO_ALERTS // 이 채팅에서 이미 알린 사용량 구간

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
    const usage = toUsage(e)

    await writeUsage($, usage)
    const found = checkAlerts(usage, alerted, await $.clock.now())

    alerted = found.alerted
    for (const message of found.messages) $.ui.toast(message, { timeoutMs: ALERT_MS })
    void refreshGit($).catch(error => logFailure($, error)) // 한 턴이 끝났으니 파일이 바뀌었을 수 있다

    return next(e)
  })

  // 빠른 실행 버튼의 진행 상태: 버튼을 누른 뒤 처음 시작하는 메인 대화의 턴을 따라간다(서브에이전트의 턴은 건너뛴다).
  // 모델의 답(answer)이나 프롬프트 글(text)은 읽지 않는다.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      resetTurnFiles()
      await beginTurn($, e.turnId)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    if (e.agentId === undefined) {
      await endTurn($, e)
      await recordTurnEnd($, e.reason) // 오늘 작업 기록: 시각·종류·고친 파일 수만
      await flashReaction($, reactionOfTurn(e.reason)) // 작업 끝·중단·실패 반응
    }

    return done
  })

  // 모델과 effort: 메인 대화가 모델 요청을 보내기 직전의 값을 기억한다(서브에이전트의 요청은 건너뛴다). 응답은 건드리지 않고 그대로 통과시킨다.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) await noteStep($, e.model, e.effort)

    return yield* next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await countPrompt($)
    await recordPrompt($)
    await recordWorkDay($) // 연속 기록: 오늘을 일한 날로

    return next(e)
  })

  // "도구 실행"은 거부되거나 실패하지 않고 끝난 호출만 센다.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true) await countAction($)

    return ran
  })

  // 파일을 고친 도구마다 훅을 하나씩 둔다. 도구 이름 둘을 도는 반복문 하나로 쓰면 타입 검사기가 두 도구의 합집합으로 입력 모양을 계산하느라
  // 메모리가 바닥난다(실측: 4GB가 모자람).
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)

    await trackIfDone($, ran, e.file_path)

    return ran
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)

    await trackIfDone($, ran, e.file_path)

    return ran
  })

  // 테스트 결과 반응: 터미널 명령 도구(Bash·PowerShell)가 끝났을 때 테스트 명령이었으면 통과·실패를 보인다. 도구마다 훅을 따로 쓴다(타입 검사기 메모리).
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)

    await noteTestRun($, ran, e.command)

    return ran
  })

  on('tool.call', { tool: 'PowerShell' }, async ($, e, next) => {
    const ran = await next(e)

    await noteTestRun($, ran, e.command)

    return ran
  })

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const ran = await next(e)

    await trackIfDone($, ran, e.notebook_path)

    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const own = await next(e)

    if (e.props.hasSurvey) return own
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const data = await readView($)

    if (e.surface === 'terminal' && e.props.maxRows >= TERMINAL_BANNER_ROWS) {
      return (
        <Box flexDirection="column">
          {own}
          {termBanner(ui as Elements['terminal'], { ...data, isHidden: await readHidden($) }, makeActions($))}
        </Box>
      )
    }
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

    if (!isRich(e.surface) && e.surface !== 'terminal') {
      return (
        <Box>
          <Text>여관 패널은 데스크톱 앱과 터미널에서만 볼 수 있어요.</Text>
        </Box>
      )
    }
    const frame = { columns: e.props.bodyColumns, rows: e.props.scroll.bodyRows, placement: e.props.placement, surface: e.surface }
    const timeline = await readTimeline($)
    const view = { ...(await readView($)), ...(await readPanel($)), today: await readToday($), projects: await readProjects($), favorites: await readFavorites($), stationTab: await readStationTab($), todos: await readTodos($), work: await readWork($), streak: await readStreak($), timeline: timeline.entries, timelineCount: timeline.count, frame }

    return e.surface === 'terminal' ? termPanelView(ui as Elements['terminal'], view, makeActions($)) : panelView(ui as Elements['desktop'], view, makeActions($))
  })
}
