import type { EngineInterface } from 'claude-code'

import type { RadioState, SceneId } from '../types'
import { SCENES } from './scenes'
import { failRadio, readRadio, readVolume, writeRadio } from './state'
import { gainOf } from './volume'

const MARKER = 'pixel-tavern-radio'
const SLOW_CONNECT_MS = 30_000 // 이만큼 지나도 "연결 중"이면 알려 준다

/**
 * Windows PowerShell의 MediaPlayer로 방송을 튼다(숨김 창, 주소는 환경변수로 받는다).
 * 반 초마다 "."을 써서 정지 신호를 빨리 알아채게 하고, 15초 넘게 소리가 안 흐르면 다시 연결한다.
 * 다른 채팅이 켜 둔 재생기(MARKER가 명령줄에 있다)는 먼저 끈다: 소리는 한 곳에서만 난다.
 */
const PLAYER = `
Add-Type -AssemblyName PresentationCore
# ${MARKER}
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.ProcessId -ne $PID -and $_.CommandLine -like '*${MARKER}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$p = New-Object System.Windows.Media.MediaPlayer
$p.Volume = [double]$env:TAVERN_VOLUME
function Open-Radio { $p.Open([uri]$env:TAVERN_URL); $p.Play(); [Console]::Out.WriteLine('connecting') }
Open-Radio
$last = 0.0; $still = 0; $isPlaying = $false
while ($true) {
  Start-Sleep -Milliseconds 500
  $pos = $p.Position.TotalSeconds
  if ($pos -gt $last + 0.1) { $still = 0; if (-not $isPlaying) { $isPlaying = $true; [Console]::Out.WriteLine('playing') } } else { $still++ }
  $last = $pos
  if ($still -ge 30) { $p.Close(); $isPlaying = $false; $still = 0; $last = 0.0; Open-Radio }
  [Console]::Out.WriteLine('.')
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

async function warnIfStillConnecting($: EngineInterface, playback: Playback): Promise<void> {
  if (playback.isStopped || (await readRadio($)) !== 'connecting') return
  $.ui.toast('방송에 아직 연결하지 못했어요. ■로 끄고 ⟳로 다른 장면의 방송을 써 보세요')
}

async function listen($: EngineInterface, playback: Playback): Promise<void> {
  let lastError = ''
  let isFailed = false
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
      const status = statusOf(text)

      if (status !== null) await writeRadio($, status, isStale)
    }
    if (!playback.isStopped) {
      isFailed = true
      await failRadio($, stoppedMessage(lastError), isStale)
      $.ui.toast(`음악 연결 실패: ${stoppedMessage(lastError)}`)
    }
  } catch (error) {
    isFailed = true
    await failRadio($, '재생기를 켜지 못했어요(Windows에서만 켤 수 있어요)', isStale)
    $.ui.toast(`음악을 켜지 못했어요: ${String(error)}`)
  } finally {
    if (current === playback) {
      current = null
      if (!isFailed) await writeRadio($, 'off')
    }
  }
}

/** 장면의 방송을 켠다. 이미 켜져 있으면 새 방송(또는 새 음량)으로 바꾼다. */
export async function startRadio($: EngineInterface, sceneId: SceneId): Promise<void> {
  const gain = gainOf(await readVolume($)) // 기다림은 옛 재생을 멈추기 전에 끝낸다: 사이에 다른 시작이 끼어들지 못하게
  if (current !== null) current.isStopped = true
  const playback: Playback = { isStopped: false, sceneId, gain }

  current = playback
  await writeRadio($, 'connecting')
  void listen($, playback)
}

/** 방송을 끈다. 재생기는 반 초 안에 꺼진다. */
export async function stopRadio($: EngineInterface): Promise<void> {
  if (current !== null) current.isStopped = true
  current = null
  await writeRadio($, 'off')
}
