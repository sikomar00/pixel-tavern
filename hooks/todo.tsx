import type { Actions } from './actions'
import { card, cardOf, chevron, header, inset, isFolded, mark, summary } from './layout'
import type { PanelData } from './panel'
import { SPACE } from './theme'
import type { Ui } from './theme'
import { orderTodos } from './todos'

const SHOWN = 15 // 한 번에 보이는 항목 수(나머지는 "…외 N개")

/**
 * 영역: 할 일. 위에 적는 칸(Enter로 더함), 아래에 항목 줄: `☐/☑`(완료) · 글자 · `☆/★`(우선). 우선인 일은 위로, 완료한 일은 아래로 간다.
 * 완료한 항목이 있을 때만 `완료한 것 지우기` 한 줄이 나온다. 접으면 "남은 N개"만 남는다. 기한·메모·하위 항목은 두지 않는다.
 */
export const todo = (ui: Ui, d: PanelData, act: Actions) => {
  const { Box, Button, Input, Text } = ui
  const folded = isFolded(d, 'todo')
  const open = d.todos.filter(t => !t.done).length
  const done = d.todos.length - open
  const ordered = orderTodos(d.todos)
  const rest = ordered.length - SHOWN

  return card(ui, d, [
    inset(ui, [
      header(ui, d, {
        title: '할 일',
        lead: [chevron(ui, d, act, 'todo')],
        trailing: [folded ? summary(ui, d, `남은 ${open}개`) : mark(ui, d, act, 'todo')],
      }),
      ...(folded ? [] : cardOf(ui, d, 'todo')),
    ]),
    ...(folded
      ? []
      : [
          inset(ui, [
            <Input key="todo:new" placeholder="할 일을 적고 Enter" submitLabel="추가" value="" onSubmit={text => act.addTodo(text)} />,
            ...(ordered.length === 0
              ? [
                  <Text color={d.scene.muted} size="caption">
                    할 일이 없어요. 위 칸에 적고 Enter를 누르세요
                  </Text>,
                ]
              : ordered.slice(0, SHOWN).map(t => (
                  <Box flexDirection="row" alignItems="center" gap={SPACE.control}>
                    <Button key={`todo:done:${t.id}`} plain label={t.done ? '☑' : '☐'} onPress={() => act.toggleTodo(t.id)} />
                    <Box flexGrow={1}>
                      <Text color={t.done ? d.scene.muted : t.star ? d.scene.accent : undefined} weight={t.star && !t.done ? 'semibold' : undefined} wrap="truncate-end">
                        {t.text}
                      </Text>
                    </Box>
                    <Button key={`todo:star:${t.id}`} plain dimColor={!t.star} label={t.star ? '★' : '☆'} onPress={() => act.starTodo(t.id)} />
                  </Box>
                ))),
            ...(rest > 0
              ? [
                  <Text color={d.scene.muted} size="caption">
                    {`…외 ${rest}개`}
                  </Text>,
                ]
              : []),
            ...(done > 0 ? [<Button key="todo:clear" plain label={`완료한 것 지우기 (${done})`} onPress={() => act.clearDoneTodos()} />] : []),
          ]),
        ]),
  ])
}
