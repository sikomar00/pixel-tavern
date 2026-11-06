export const baseName = (path: string): string =>
  path.split(/[\\/]/).filter(Boolean).pop() ?? path

/** 줄바꿈 같은 제어 문자를 뺀다. 엔진은 제어 문자가 든 글자를 거부해 패널 전체를 못 그린다. */
export const withoutControl = (text: string): string => text.replace(/[\u0000-\u001f\u007f]/g, '')

/**
 * 파일 경로의 짧은 지문(FNV-1a 32비트, 16진수 8자리). 오늘 수정한 파일을 "한 번만 세기" 위해 경로 대신 저장한다:
 * 저장소가 작아지고 절대 경로를 남기지 않는다. 역슬래시는 슬래시로 맞춰 같은 파일이 두 번 세어지지 않게 한다.
 * 서로 다른 파일이 같은 지문이 될 확률은 파일 500개에서도 10만분의 3 정도다.
 */
export const fingerprint = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  let hash = 0x811c9dc5

  for (let i = 0; i < normalized.length; i += 1) hash = Math.imul(hash ^ normalized.charCodeAt(i), 0x01000193)

  return (hash >>> 0).toString(16).padStart(8, '0')
}

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

/** 배너·패널에 쓰는 모델 한 줄: `Sonnet 5.5 · high`(effort를 모르면 모델만, 모델을 모르면 빈 글자). */
export const modelText = (model: string | null, effort: string | null): string =>
  model === null ? '' : [shortModel(model), ...(effort === null ? [] : [effort])].join(' · ')

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
