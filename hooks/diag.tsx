import type { Elements } from 'claude-code'

import type { Scene } from './scenes'
import { SPACE, chipOf } from './theme'
import type { Gap } from './theme'

type Ui = Elements['desktop']

/** 패널 틀 정보: 렌더 훅이 받는 값(열 수는 글자 칸 단위). */
export type Frame = { columns: number; rows: number; placement: string; surface: string }

const STEPS: Gap[] = ['xs', 'sm', 'md', 'lg', 'xl']
const SIZES = ['caption', 'footnote', 'body', 'heading', 'title'] as const

/** 10px마다 눈금이 있는 가로 자. 그림 폭은 CSS px로 선언해서, 화면에서 줄어들면 패널 폭을 알 수 있다. */
const ruler = (width: number): string => {
  const ticks = Array.from({ length: Math.floor(width / 10) + 1 }, (_, i) => {
    const isMajor = i % 5 === 0

    return `<rect x="${i * 10}" y="${isMajor ? 0 : 7}" width="1" height="${isMajor ? 14 : 7}" fill="#ffffff"/>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 14" width="${width}" height="14"><rect width="${width}" height="14" fill="#ffffff" fill-opacity=".14"/>${ticks}</svg>`
}

/**
 * 측정판. 켜면 패널 맨 위에 나온다: 열·줄 수, px 기준자, 칸 기준자, 간격 단계, 글자 크기, 버튼 표본.
 * 기준자 그림(100px·300px)은 선언한 px 그대로 그려지므로, 캡처에서 다른 표본의 크기를 px로 환산할 수 있다.
 */
export const diagBoard = (ui: Ui, { scene, frame }: { scene: Scene; frame: Frame }) => {
  const { Box, Button, Svg, Text } = ui
  const note = (text: string) => (
    <Text size="caption" color={scene.muted}>
      {text}
    </Text>
  )

  return (
    <Box flexDirection="column" backgroundColor={chipOf(scene)} paddingX={SPACE.edge} paddingY={SPACE.band} gap={SPACE.stack}>
      <Text weight="semibold" color={scene.accent}>
        측정판 · /tavern-diag 로 끄기
      </Text>
      <Text size="caption" mono>
        {`열 ${frame.columns} · 줄 ${frame.rows} · ${frame.placement} · ${frame.surface}`}
      </Text>
      {note('px 기준자(선언한 그대로 100px, 300px. 줄어들면 패널이 그만큼 좁다)')}
      <Svg source={ruler(100)} alt="100px 기준자" width={100} height={14} />
      <Svg source={ruler(300)} alt="300px 기준자" width={300} height={14} />
      {note('칸 기준자(10·20·30칸. 패널보다 넓으면 잘리거나 줄바꿈된다)')}
      {[10, 20, 30].map(cells => (
        <Box width={cells} backgroundColor={scene.accent}>
          <Text size="caption" color={scene.base}>
            {`${cells}칸`}
          </Text>
        </Box>
      ))}
      {note('간격 단계(xs~xl): 표본 상자의 안쪽 여백')}
      {STEPS.map(step => (
        <Box flexDirection="row" alignItems="center" gap={SPACE.control}>
          <Text size="caption" mono>
            {step}
          </Text>
          <Box backgroundColor={scene.accent} paddingX={step} paddingY={step}>
            <Text size="caption" color={scene.base}>
              가
            </Text>
          </Box>
        </Box>
      ))}
      {note('글자 크기(caption~title)')}
      {SIZES.map(size => (
        <Text size={size}>{`${size} 가나다라마바 Hg 0123`}</Text>
      ))}
      {note('버튼 표본')}
      <Box flexDirection="row" alignItems="center" gap={SPACE.control}>
        <Button key="diag-button" label="버튼" onPress={() => undefined} />
        <Button key="diag-plain" plain label="plain" onPress={() => undefined} />
      </Box>
    </Box>
  )
}
