# Windows에 들어 있는 WinRT 재생기(Windows.Media.Playback.MediaPlayer)가 주소 하나를 음량 0으로 재생하는지, CPU·메모리는 얼마인지 잰다.
# 새 프로그램을 내려받지 않는다. https 방송 조사(R-13)용이며 모드가 쓰는 재생기(WPF MediaPlayer)와는 따로 도는 점검이다. 글자는 영어만 쓴다(Windows PowerShell 5.1은 BOM 없는 UTF-8 한글을 못 읽는다).
#   powershell.exe -NoProfile -File tools/winrt_probe.ps1 -Url https://ice1.somafm.com/groovesalad-128-mp3 -Seconds 40
param([string]$Url = 'http://listen.reyfm.de/lofi_320kbps.mp3', [int]$Seconds = 30)
$t0 = Get-Date
function Stamp { '{0:N1}s' -f ((Get-Date) - $t0).TotalSeconds }
$null = [Windows.Media.Playback.MediaPlayer, Windows.Media.Playback, ContentType = WindowsRuntime]
$null = [Windows.Media.Core.MediaSource, Windows.Media.Core, ContentType = WindowsRuntime]
$p = New-Object Windows.Media.Playback.MediaPlayer
$p.Volume = 0
$p.Source = [Windows.Media.Core.MediaSource]::CreateFromUri([Uri]$Url)
$p.Play()
$states = New-Object System.Collections.ArrayList
$playing = $null; $lastState = ''; $cpuAt10 = 0
for ($i = 0; $i -lt $Seconds * 2; $i++) {
  Start-Sleep -Milliseconds 500
  $s = [string]$p.PlaybackSession.PlaybackState
  if ($s -ne $lastState) { $null = $states.Add("$(Stamp) $s"); $lastState = $s }
  if ($s -eq 'Playing' -and -not $playing) { $playing = Stamp }
  if ($i -eq 19) { $cpuAt10 = (Get-Process -Id $PID).CPU }
}
$me = Get-Process -Id $PID
$result = if ($playing) { "PLAYING since $playing (position $([int]$p.PlaybackSession.Position.TotalSeconds)s)" } else { "NOT PLAYING within $Seconds s" }
$usage = 'cpu {0:N2}s over the last {1}s, working set {2:N0} MB' -f ($me.CPU - $cpuAt10), ($Seconds - 10), ($me.WorkingSet64 / 1MB)
"WinRT $Url -> $result  states: $($states -join ' | ') | $usage"
$p.Dispose()
