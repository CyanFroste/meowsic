import { Button } from '@heroui/react'
import { Trash2Icon } from 'lucide-react'
import { reorder } from '@/utils'
import { usePlayer } from '@/player'
import { AppBar, SelectAllControls } from '@/components'
import { List, ListItem, useTrackSelection } from '@/tracks/components'
import { useTrackDetails } from '@/tracks/components/details'
import type { DropResult } from '@hello-pangea/dnd'

export function QueueScreen() {
  const player = usePlayer()
  const selection = useTrackSelection()
  const trackDetails = useTrackDetails()

  const onRemove = async () => {
    if (!player.current) return

    // case: remove all tracks when selection is empty, reset player state
    if (!selection.values.length) return await player.reset()

    const filtered = player.queue.filter(track => !selection.isSelected(track))

    // case: if remaining queue is empty, reset player state
    if (!filtered.length) await player.reset()
    else {
      await player.setQueue(filtered)
      const index = filtered.findIndex(track => track === player.current)

      // case: current track was not removed
      if (index !== -1) {
        await player.setCurrent(index)
        player.setState({ queue: filtered, current: index })
      } else {
        // case: current track was removed
        player.setState({ queue: filtered })
        await player.goto(0)
        await player.pause()
      }
    }

    selection.clear()
  }

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    const src = result.source.index
    const dst = result.destination.index
    if (src === dst) return

    const reordered = reorder(player.queue, src, dst)
    const index = reordered.findIndex(it => it === player.current) // compare by reference

    // optimistic update for smooth user experience
    player.setState({ queue: reordered, current: index })

    await player.setQueue(reordered)
    await player.setCurrent(index)
  }

  return (
    <div className="flex flex-col size-full relative">
      <AppBar>
        {selection.values.length > 0 && (
          <>
            <SelectAllControls data={player.queue} selection={selection} />
            <div className="h-5 border-r border-default/30" />
          </>
        )}

        <Button
          radius="sm"
          variant="flat"
          color="danger"
          className="!text-foreground"
          onPress={onRemove}
          isDisabled={!player.queue.length}>
          <Trash2Icon className="text-lg" /> Remove {selection.values.length > 0 ? 'Selected' : 'All'}
        </Button>
      </AppBar>

      <List data={player.queue} onDragEnd={onDragEnd}>
        {(item, index, draggableProps) => (
          <ListItem
            key={item.hash}
            index={index}
            data={item}
            isSelected={selection.isSelected(item)}
            isPlaying={player.current?.hash === item.hash}
            onToggleSelect={selection.toggle}
            draggableProps={draggableProps}
            onShowDetails={trackDetails.show}
            onPlay={async () => {
              await player.goto(index)
              await player.play()
            }}
          />
        )}
      </List>
    </div>
  )
}
