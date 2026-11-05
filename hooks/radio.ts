import type { EngineInterface } from 'claude-code'

import type { RadioState, SceneId } from '../types'
import { SCENES } from './scenes'
import { failRadio, readRadio, readVolume, writeMusicAvailable, writeRadio, yieldRadio } from './state'
import { gainOf } from './volume'

const MARKER = 'pixel-tavern-radio'
const SLOW_CONNECT_MS = 30_000 // 이만큼 지나도 "연결 중"이면 알려 준다
// 이 채팅의 이름표. 음악을 켤 때 저장소에 적어 두면, 재생기가 꺼졌을 때 "다른 채팅이 가져갔나"를 알 수 있다.
// 저장소가 채팅끼리 바로 공유되지 않으면 항상 내 이름표가 읽혀서 예전처럼 "연결 실패"로 보인다(나빠지지는 않는다).
const MAX_TRIES = 5 // 재생기 스크립트가 방송에 다시 연결해 보는 횟수. 넘으면 포기를 알리고 끝낸다
const CHAT_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Windows PowerShell의 MediaPlayer로 방송을 튼다(숨김 창, 주소는 환경변수로 받는다).
 * 반 초마다 "."을 써서 정지 신호를 빨리 알아채게 하고, 15초 넘게 소리가 안 흐르면 다시 연결한다(5번까지, 그래도 안 되면 "gaveup"을 알리고 끝낸다).
 * 부모(엔진) 프로세스가 사라지면 스스로 끝난다: 앱이 강제 종료돼도 소리만 나는 고아가 남지 않는다. 출력 파이프가 끊겨도 .NET은 쓰기 오류를 무시해서 파이프로는 알 수 없다(실험으로 확인).
 * 단, 시작 5초 뒤에도 부모가 살아 있을 때만 감시한다(바로 끝나는 실행기 뒤에 숨은 경우에는 소리가 끊기면 안 된다).
 * 다른 채팅이 켜 둔 재생기(MARKER가 명령줄에 있다)는 먼저 끈다: 소리는 한 곳에서만 난다.
 */
export const PLAYER = `
Add-Type -AssemblyName PresentationCore
# ${MARKER}
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.ProcessId -ne $PID -and $_.CommandLine -like '*${MARKER}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$p = New-Object System.Windows.Media.MediaPlayer
$p.Volume = [double]$env:TAVERN_VOLUME
function Say($s) { [Console]::Out.WriteLine($s) }
$parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
$age = 0; $watch = $false
function Open-Radio { $p.Open([uri]$env:TAVERN_URL); $p.Play(); Say 'connecting' }
$tries = 0
Open-Radio
$last = 0.0; $still = 0; $isPlaying = $false
while ($true) {
  Start-Sleep -Milliseconds 500
  $age++
  if ($age -eq 10) { $watch = ($parent -gt 0) -and [bool](Get-Process -Id $parent -ErrorAction SilentlyContinue) }
  if ($watch -and $age % 10 -eq 0 -and -not (Get-Process -Id $parent -ErrorAction SilentlyContinue)) { exit }
  $pos = $p.Position.TotalSeconds
  if ($pos -gt $last + 0.1) { $still = 0; if (-not $isPlaying) { $isPlaying = $true; $tries = 0; Say 'playing' } } else { $still++ }
  $last = $pos
  if ($still -ge 30) {
    $tries++
    if ($tries -ge ${MAX_TRIES}) { Say 'gaveup'; exit }
    $p.Close(); $isPlaying = $false; $still = 0; $last = 0.0; Open-Radio
  }
  Say '.'
}
`

type Playback = { isStopped: boolean; sceneId: SceneId; gain: string }

// 이 채팅에서 지금 도는 재생. 모드를 다시 불러오면 자식 프로세스도 함께 끝나므로 null에서 다시 시작한다.
let current: Playback | null = null

const statusOf = (text: string): RadioState | null => {
  const found = text.match(/connecting|playing/g) ?? []
  const last = found[found.length - 1]

  return last === 'connecting' || last === 'playing' ? last : null
}

const stoppedMessage = (error: string): string =>
  error === '' ? '재생기가 멈췄어요. 다른 채팅에서 음악을 켰을 수 있어요' : `재생기가 멈췄어요: ${error.slice(0, 80)}`

async function isTakenOver($: EngineInterface): Promise<boolean> {
  const owner = await $.store.get('radioOwner')

  return typeof owner === 'string' && owner !== '' && owner !== CHAT_ID
}

/** 이 환경에서 음악을 쓸 수 있는지 한 번 본다: 윈도우에만 있는 `where.exe`로 PowerShell을 찾는다. 없으면 음악 버튼을 숨긴다. */
export async function detectMusic($: EngineInterface): Promise<void> {
  const found = await $.process.run(['where.exe', 'powershell.exe']).catch(() => null)

  await writeMusicAvailable($, found !== null && found.exitCode === 0)
}

async function warnIfStillConnecting($: EngineInterface, playback: Playback): Promise<void> {
  if (playback.isStopped || (await readRadio($)) !== 'connecting') return
  $.ui.toast('방송에 아직 연결하지 못했어요. ■로 끄고 ⟳로 다른 장면의 방송을 써 보세요')
}

async function listen($: EngineInterface, playback: Playback): Promise<void> {
  let lastError = ''
  let isSettled = false // 실패·가로채임으로 상태를 이미 정했다
  const isStale = () => playback.isStopped

  try {
    const child = $.process.spawn({
      argv: ['powershell.exe', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', PLAYER],
      env: { TAVERN_URL: SCENES[playback.sceneId].music.stream, TAVERN_VOLUME: playback.gain },
    })

    $.clock.after(SLOW_CONNECT_MS, () => void warnIfStillConnecting($, playback))
    // 반복문이 곧 자식의 수명이다: break로 나오면 재생기가 꺼진다.
    for await (const { stream, text } of child) {
      if (playback.isStopped) break
      if (stream === 'stderr') {
        lastError = text.trim()
        continue
      }
      if (text.includes('gaveup')) {
        isSettled = true
        await failRadio($, `방송에 연결하지 못했어요(${MAX_TRIES}번 시도). 다른 장면의 방송을 써 보세요`, isStale)
        $.ui.toast('음악 연결 실패: 방송 서버가 응답하지 않아요')
        break
      }
      const status = statusOf(text)

      if (status !== null) await writeRadio($, status, isStale)
    }
    if (!playback.isStopped && !isSettled) {
      isSettled = true
      if (await isTakenOver($)) {
        await yieldRadio($, isStale)
        $.ui.toast('다른 채팅에서 음악을 켜서 이 채팅의 음악은 멈췄어요')
      } else {
        await failRadio($, stoppedMessage(lastError), isStale)
        $.ui.toast(`음악 연결 실패: ${stoppedMessage(lastError)}`)
      }
    }
  } catch (error) {
    isSettled = true
    await failRadio($, '재생기를 켜지 못했어요(Windows에서만 켤 수 있어요)', isStale)
    $.ui.toast(`음악을 켜지 못했어요: ${String(error)}`)
  } finally {
    if (current === playback) {
      current = null
      if (!isSettled) await writeRadio($, 'off')
    }
  }
}

/** 장면의 방송을 켠다. 이미 켜져 있으면 새 방송(또는 새 음량)으로 바꾼다. */
export async function startRadio($: EngineInterface, sceneId: SceneId): Promise<void> {
  const gain = gainOf(await readVolume($)) // 기다림은 옛 재생을 멈추기 전에 끝낸다: 사이에 다른 시작이 끼어들지 못하게
  if (current !== null) current.isStopped = true
  const playback: Playback = { isStopped: false, sceneId, gain }

  current = playback
  await $.store.set('radioOwner', CHAT_ID)
  await writeRadio($, 'connecting')
  void listen($, playback)
}

/** 방송을 끈다. 재생기는 반 초 안에 꺼진다. */
export async function stopRadio($: EngineInterface): Promise<void> {
  if (current !== null) current.isStopped = true
  current = null
  await writeRadio($, 'off')
}
