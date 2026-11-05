export const baseName = (path: string): string =>
  path.split(/[\\/]/).filter(Boolean).pop() ?? path

/** 폴더 이름 하나를 붙여 같은 이름의 파일을 구분한다: `hooks/radio.ts` */
export const shortPath = (path: string): string => path.split(/[\\/]/).filter(Boolean).slice(-2).join('/')

/** `claude-sonnet-5-5` -> `Sonnet 5.5`. 이미 보기 좋은 이름이면 그대로 둔다. */
export const shortModel = (id: string): string => {
  const words = id
    .replace(/^claude-/, '')
    .replace(/-(\d+)-(\d+)$/, ' $1.$2')
    .replace(/-/g, ' ')

  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const fmtTokens = (n: number): string => `${Math.round(n / 1000)}k`

/** 리셋까지 남은 시간을 짧게: `2d 3h`, `1h 37m`, `12m`. */
export const fmtReset = (iso: string | undefined, now: number): string => {
  if (iso === undefined) return ''
  const ms = Date.parse(iso) - now

  if (!(ms > 0)) return '곧'
  const minutes = Math.floor(ms / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`

  return `${minutes}m`
}

/** 리셋 시각이 이미 지났나. 지났다면 그 한도의 사용량은 옛 값이다(다음 응답이 올 때까지 갱신되지 않는다). */
export const isPast = (iso: string | undefined, now: number): boolean => iso !== undefined && Date.parse(iso) <= now

/** 자정이 지나면 값이 바뀌는 날짜 키(기기 시간대). */
export const todayKey = (ms: number): string => {
  const d = new Date(ms)

  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
