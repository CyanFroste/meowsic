import { useEffect, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { cn } from '@heroui/react'
import type { DraggableProvided, DraggableRubric, DraggableStateSnapshot, DropResult } from '@hello-pangea/dnd'
import type { ItemProps as VirtuosoItemProps, ContextProp as VirtuosoContextProps } from 'react-virtuoso'

const DEFAULT_OVERSCAN = 10

type SortableVirtualListProps<T> = {
  data: T[]
  isDragDisabled?: boolean
  className?: string
  overscan?: number
  renderClone: RenderDraggableClone
  children: SortableListChildren<T>
  onDragEnd?: OnDragEnd
  getItemKey: (item: T, index: number) => string
  components: {
    Container?: (props: ContainerProps) => React.ReactNode
    Header?: (props: HeaderProps) => React.ReactNode
  }
}

export function SortableVirtualList<T>({
  data,
  children,
  onDragEnd,
  isDragDisabled,
  getItemKey,
  renderClone,
  className,
  overscan = DEFAULT_OVERSCAN,
  components: { Container, Header },
}: SortableVirtualListProps<T>) {
  return (
    <DragDropContext onDragEnd={onDragEnd ?? (() => {})}>
      <Droppable mode="virtual" droppableId="droppable" renderClone={renderClone}>
        {provided => {
          const ref = (el: Window | HTMLElement | null) => provided.innerRef(el as HTMLElement)

          return (
            <Virtuoso
              scrollerRef={ref}
              data={data}
              overscan={overscan}
              components={{ Item: VirtualItem, List: Container, Header }}
              className={cn('size-full shrink-0', className)}
              itemContent={(index, item) => {
                if (isDragDisabled || !onDragEnd) return children(item, index)
                const key = getItemKey(item, index)

                return (
                  <Draggable key={key} index={index} draggableId={key}>
                    {(provided, snapshot) => children(item, index, { provided, snapshot })}
                  </Draggable>
                )
              }}
            />
          )
        }}
      </Droppable>
    </DragDropContext>
  )
}

type VirtualListProps<T> = {
  data: T[]
  className?: string
  overscan?: number
  children: ListChildren<T>
  components: {
    Container?: (props: ContainerProps) => React.ReactNode
    Header?: (props: HeaderProps) => React.ReactNode
    Footer?: (props: FooterProps) => React.ReactNode
  }
}

export function VirtualList<T>({
  data,
  children,
  className,
  overscan = DEFAULT_OVERSCAN,
  components: { Container, Header, Footer },
}: VirtualListProps<T>) {
  return (
    <Virtuoso
      data={data}
      overscan={overscan}
      components={{ Item: VirtualItem, List: Container, Header, Footer }}
      className={cn('size-full shrink-0', className)}
      itemContent={(index, item) => children(item, index)}
    />
  )
}

type VirtualItemProps<T> = VirtuosoItemProps<T>

function VirtualItem<T>({ item, ...props }: VirtualItemProps<T>) {
  // needed to preserve height
  const [size, setSize] = useState(0)
  const knownSize = props['data-known-size']

  useEffect(() => {
    if (knownSize) setSize(knownSize)
  }, [knownSize])

  return (
    <div
      {...props}
      style={{ ...props.style, '--item-height': `${size}px` } as React.CSSProperties}
      className="empty:min-h-(--item-height) empty:box-border"
    />
  )
}

export type DraggableProps = { provided: DraggableProvided; snapshot: DraggableStateSnapshot }

export type HeaderProps<T = unknown> = VirtuosoContextProps<T>
export type FooterProps<T = unknown> = VirtuosoContextProps<T>

export type ContainerProps = React.HTMLAttributes<HTMLDivElement>

export type SortableListChildren<T> = (item: T, index: number, draggableProps?: DraggableProps) => React.ReactNode
export type ListChildren<T> = (item: T, index: number) => React.ReactNode

export type RenderDraggableClone = (
  provided: DraggableProvided,
  snapshot: DraggableStateSnapshot,
  rubric: DraggableRubric,
) => React.ReactNode

export type OnDragEnd = (result: DropResult) => void
