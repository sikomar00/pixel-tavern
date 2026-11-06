import type { EngineInterface } from 'claude-code'

import { withoutControl } from './format'

// 지금 나오는 곡의 제목(ICY 메타데이터)을 읽는다. 재생기(MediaPlayer)는 제목을 알려 주지 않아서, 같은 방송에 아주 짧게 따로 접속해
// 첫 메타데이터 한 덩어리만 읽고 끊는다(오디오는 방송 간격 하나, 보통 16KB쯤). 제목은 화면에 보이기만 하고 어디에도 저장하지 않는다.
//
// 스크립트는 .NET 소켓으로 직접 HTTP를 말한다: 많은 방송이 "ICY 200 OK"라는 HTTP가 아닌 첫 줄을 보내서 HttpWebRequest는 거부하기 때문이다.
// 제한: http만(방송 주소는 모두 http), 리다이렉트는 3번까지, 소켓 제한 시간 6초, 메타데이터 간격 25만 바이트까지.
// 출력은 한 줄 `title:<UTF-16 코드 단위를 쉼표로 이은 숫자>`다. 콘솔 글자 깨짐을 피하려고 글자 대신 숫자로 보낸다.
// 메타데이터를 보내지 않는 방송은 아무것도 쓰지 않고 끝난다. 이 스크립트에는 재생기의 표식(radio.ts의 MARKER)이 없다:
// 새 재생기가 "다른 재생기를 끄는" 검사에 이 조회가 걸려 꺼지지 않게 한다.
export const TITLE_SCRIPT = `
$ErrorActionPreference = 'Stop'
# pixel-tavern-title
$crlf = [string][char]13 + [string][char]10
function Read-Line($s) {
  $sb = New-Object System.Text.StringBuilder
  while ($true) { $b = $s.ReadByte(); if ($b -lt 0 -or $b -eq 10) { break }; if ($b -ne 13) { [void]$sb.Append([char]$b) } }
  $sb.ToString()
}
function Read-Exact($s, [int]$n) {
  $buf = New-Object byte[] $n; $got = 0
  while ($got -lt $n) { $r = $s.Read($buf, $got, $n - $got); if ($r -le 0) { throw 'closed' }; $got += $r }
  ,$buf
}
function Open-Icy([string]$url) {
  $u = [uri]$url
  if ($u.Scheme -ne 'http') { throw 'http only' }
  $c = New-Object System.Net.Sockets.TcpClient
  $c.ReceiveTimeout = 6000; $c.SendTimeout = 6000
  $c.Connect($u.Host, $u.Port)
  $s = $c.GetStream()
  $q = 'GET ' + $u.PathAndQuery + ' HTTP/1.0' + $crlf + 'Host: ' + $u.Host + $crlf + 'User-Agent: pixel-tavern' + $crlf + 'Icy-MetaData: 1' + $crlf + 'Connection: close' + $crlf + $crlf
  $bytes = [Text.Encoding]::ASCII.GetBytes($q); $s.Write($bytes, 0, $bytes.Length)
  $status = Read-Line $s
  $h = @{}
  while ($true) { $line = Read-Line $s; if ($line -eq '') { break }; $i = $line.IndexOf(':'); if ($i -gt 0) { $h[$line.Substring(0, $i).Trim().ToLower()] = $line.Substring($i + 1).Trim() } }
  [pscustomobject]@{ Client = $c; Stream = $s; Status = $status; Headers = $h }
}
$url = $env:TAVERN_URL
$conn = $null
for ($hop = 0; $hop -lt 4; $hop++) {
  $conn = Open-Icy $url
  if ($conn.Status -match ' 30[1278]( |$)' -and $conn.Headers['location']) { $url = $conn.Headers['location']; $conn.Client.Close(); $conn = $null; continue }
  break
}
if ($null -eq $conn) { exit 1 }
$interval = 0
[void][int]::TryParse([string]$conn.Headers['icy-metaint'], [ref]$interval)
if ($interval -le 0 -or $interval -gt 262144) { $conn.Client.Close(); exit 0 }
$title = $null
for ($round = 0; $round -lt 3 -and $null -eq $title; $round++) {
  $left = $interval
  while ($left -gt 0) { $n = [Math]::Min($left, 4096); [void](Read-Exact $conn.Stream $n); $left -= $n }
  $len = $conn.Stream.ReadByte() * 16
  if ($len -gt 0) {
    $meta = [Text.Encoding]::UTF8.GetString((Read-Exact $conn.Stream $len)).Replace([string][char]0, '')
    $m = [regex]::Match($meta, 'StreamTitle=''(.*?)''(;|$)', 'Singleline')
    $title = if ($m.Success) { $m.Groups[1].Value } else { '' }
  }
}
$conn.Client.Close()
if ($null -ne $title) { [Console]::Out.WriteLine('title:' + (($title.ToCharArray() | ForEach-Object { [int]$_ }) -join ',')) }
`

const TITLE_MAX = 80 // 화면에 쓰는 제목의 최대 글자 수

/** 스크립트가 쓴 `title:숫자,숫자,…` 줄을 제목으로. 그런 줄이 없으면 null(이 방송은 제목을 보내지 않는다). 제어 문자는 빼고, 공백은 하나로, 너무 길면 자른다. */
export const parseTitle = (stdout: string): string | null => {
  const line = stdout.split(/\r?\n/).find(entry => entry.startsWith('title:'))

  if (line === undefined) return null
  const codes = line
    .slice('title:'.length)
    .split(',')
    .map(Number)
    .filter(code => Number.isInteger(code) && code >= 0 && code <= 0xffff)
  const text = withoutControl(String.fromCharCode(...codes)).replace(/\s+/g, ' ').trim()

  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text
}

/** parseTitle이 읽는 줄을 만든다(시험과 점검 도구가 가짜 출력을 만들 때 쓴다). */
export const titleLine = (text: string): string => `title:${Array.from({ length: text.length }, (_, i) => text.charCodeAt(i)).join(',')}`

/**
 * 방송 주소(`stream`)에 잠깐 접속해 지금 곡의 제목을 읽는다. 제목을 보내지 않는 방송이면 null, 있으면 글자(빈 글자일 수도 있다).
 * 접속하지 못하거나 시간이 지나면(15초) 오류를 던진다 — 부르는 쪽이 건너뛴다.
 */
export async function fetchTitle($: EngineInterface, stream: string, launch: readonly string[]): Promise<string | null> {
  const run = await $.process.run(['powershell.exe', ...launch, TITLE_SCRIPT], { env: { TAVERN_URL: stream }, timeoutMs: 15_000 })

  if (run.exitCode !== 0) throw new Error(`title lookup exited with ${run.exitCode}`)

  return parseTitle(run.stdout)
}
