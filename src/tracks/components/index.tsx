import { memo, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Checkbox,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  cn,
  useDisclosure,
} from '@heroui/react'
import {
  ClockIcon,
  Disc3Icon,
  GripVerticalIcon,
  ListMusicIcon,
  ListVideoIcon,
  MoveLeftIcon,
  PlayIcon,
  PlusIcon,
  UserRoundIcon,
} from 'lucide-react'
import { useDebounce } from 'use-debounce'
import { useSelection } from '@/utils'
import { extendQueue, usePlayer } from '@/player'
import { setMiniPlayerVisibility, setPlayerMaximized } from '@/settings'
import { addPlaylist, addPlaylistTracks, getPlaylists } from '@/playlists'
import { SearchBar, SelectAllControls, AppBar } from '@/components'
import { SortableVirtualList } from '@/components/lists'
import { PlaylistEditorModal } from '@/playlists/components'
import { createSearchIndex, getTracks, normalizeMeta } from '@/tracks'
import { AlbumLink, ArtistLink, Cover, PropertyText, useTrackDetails } from '@/tracks/components/details'
import type { Track } from '@/tracks'
import type {
  DraggableProps,
  OnDragEnd,
  RenderDraggableClone,
  SortableListChildren,
  HeaderProps as ListHeaderProps,
  ContainerProps as ListContainerProps,
} from '@/components/lists'

const searchIndex = createSearchIndex()

export function TracksScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { album, artist } = parseFilters(searchParams)
  const player = usePlayer()
  const trackDetails = useTrackDetails()

  const query = useQuery({
    queryKey: ['tracks', album, artist],
    queryFn: async () => await getTracks({ album, artist }),
  })

  const sort = (tracks: Track[] = []) => {
    if (!album) return tracks

    return tracks.sort((a, b) => {
      if (!a.number && !b.number) return 0
      if (!a.number && a.number !== 0) return 1
      if (!b.number && b.number !== 0) return -1
      return a.number - b.number
    })
  }

  const map = new Map(query.data?.map(t => [t.hash, t]) ?? [])
  const [filtered, setFiltered] = useState(() => sort(query.data))

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery] = useDebounce(searchQuery, 500)

  useEffect(() => {
    if (!debouncedSearchQuery.trim()) return setFiltered(sort(query.data))

    const data = searchIndex
      .search(debouncedSearchQuery)
      .map(it => map.get(it.id))
      .filter(Boolean) as Track[]

    setFiltered(sort(data))
  }, [query.data, debouncedSearchQuery])

  useEffect(() => {
    searchIndex.removeAll()
    searchIndex.addAll(query.data ?? [])
  }, [query.data])

  const onPlay = async (data: Track | Track[]) => {
    await player.playTracks(data)
    player.setTemplate(null)

    setPlayerMaximized(true)
    setMiniPlayerVisibility(true)
  }

  const selection = useTrackSelection()
  const playlistEditorModal = useDisclosure()

  const queryPlaylists = useQuery({ queryKey: ['playlists'], queryFn: getPlaylists })
  const playlists = queryPlaylists.data ?? []

  return (
    <div className="flex flex-col size-full relative">
      <AppBar>
        {selection.values.length > 0 ? (
          <>
            {query.isSuccess && (
              <>
                <SelectAllControls data={filtered} selection={selection} />
                <div className="h-5 border-r border-default/30" />
              </>
            )}

            <Button radius="sm" variant="flat" color="secondary" onPress={() => onPlay(selection.values)}>
              <PlayIcon className="text-lg" /> Play
            </Button>

            <Button
              radius="sm"
              variant="flat"
              onPress={async () => {
                await extendQueue(selection.values)
                selection.clear()
              }}>
              <ListVideoIcon className="text-lg" /> Add to Queue
            </Button>

            <Dropdown radius="sm" backdrop="opaque">
              <DropdownTrigger>
                <Button radius="sm" variant="flat">
                  <PlusIcon className="text-lg" /> Add to Playlist
                </Button>
              </DropdownTrigger>

              <DropdownMenu variant="flat">
                <DropdownSection showDivider={playlists.length > 0} className={cn(!playlists.length && 'mb-0')}>
                  <DropdownItem
                    key="new"
                    startContent={<ListMusicIcon className="text-lg" />}
                    onPress={playlistEditorModal.onOpen}>
                    New Playlist
                  </DropdownItem>
                </DropdownSection>

                <DropdownSection className="mb-0">
                  {playlists.map(name => (
                    <DropdownItem
                      key={name}
                      onPress={async () => {
                        await addPlaylistTracks(name, selection.values)
                        selection.clear()
                        // navigate(`/playlists/${name}`)
                      }}>
                      {name}
                    </DropdownItem>
                  ))}
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>
          </>
        ) : (
          <>
            {(album || artist) && (
              <Button as={Link} isIconOnly radius="sm" variant="flat" to={album ? '/albums' : '/artists'}>
                <MoveLeftIcon className="text-lg" />
              </Button>
            )}

            <Button
              radius="sm"
              variant="flat"
              color="secondary"
              className="mr-auto"
              isDisabled={!filtered.length}
              onPress={() => {
                if (filtered.length > 0) onPlay(filtered)
              }}>
              <PlayIcon className="text-lg" /> Play All
            </Button>

            {album && (
              <Chip
                variant="flat"
                size="lg"
                color="warning"
                startContent={<Disc3Icon className="text-lg" />}
                onClose={() => navigate('/tracks')}>
                <div className="text-small px-2">{album}</div>
              </Chip>
            )}

            {artist && (
              <Chip
                variant="flat"
                size="lg"
                color="warning"
                startContent={<UserRoundIcon className="text-lg" />}
                onClose={() => navigate('/tracks')}>
                <div className="text-small px-2">{artist}</div>
              </Chip>
            )}

            {(album || artist) && <div className="h-6 border-r border-default/30" />}

            <SearchBar value={searchQuery} onChange={setSearchQuery} className="w-120" />
          </>
        )}
      </AppBar>

      <List data={filtered}>
        {(item, index, draggableProps) => (
          <ListItem
            key={item.hash}
            index={index}
            data={item}
            onPlay={onPlay}
            isSelected={selection.isSelected(item)}
            isPlaying={player.current?.hash === item.hash}
            onToggleSelect={selection.toggle}
            draggableProps={draggableProps}
            onShowDetails={trackDetails.show}
          />
        )}
      </List>

      <PlaylistEditorModal
        type="new"
        isOpen={playlistEditorModal.isOpen}
        onOpenChange={playlistEditorModal.onOpenChange}
        onAction={async name => {
          await addPlaylist(name)
          await addPlaylistTracks(name, selection.values)
          playlistEditorModal.onClose()
          selection.clear()
          // navigate(`/playlists/${name}`)
        }}
      />
    </div>
  )
}

type ListProps = {
  data: Track[]
  isDragDisabled?: boolean
  onDragEnd?: OnDragEnd
  children: SortableListChildren<Track>
}

export function List({ data, children, onDragEnd, isDragDisabled }: ListProps) {
  const renderClone: RenderDraggableClone = (provided, snapshot, rubric) => (
    <ListItem data={data[rubric.source.index]} draggableProps={{ provided, snapshot }} />
  )

  return (
    <SortableVirtualList
      data={data}
      onDragEnd={onDragEnd}
      isDragDisabled={isDragDisabled}
      getItemKey={getKey}
      children={children}
      renderClone={renderClone}
      components={{ Container: ListContainer, Header: ListHeader }}
    />
  )
}

type ListItemProps = {
  data: Track
  isPlaying?: boolean
  isSelected?: boolean
  index?: number
  draggableProps?: DraggableProps
  onPlay?: (data: Track) => void
  onShowDetails?: (data: Track) => void
  onToggleSelect?: (data: Track, previouslySelected?: boolean) => void
}

export const ListItem = memo(
  ({ data, isPlaying, isSelected, onPlay, onToggleSelect, draggableProps, onShowDetails }: ListItemProps) => {
    const meta = normalizeMeta(data)

    return (
      <div
        // TODO: a separate drag handle ?
        ref={draggableProps?.provided.innerRef}
        {...draggableProps?.provided.draggableProps}
        {...draggableProps?.provided.dragHandleProps}
        style={draggableProps?.provided.draggableProps.style}
        className={cn(
          'flex items-center gap-3 p-3 !cursor-default',
          draggableProps?.snapshot.isDragging &&
            'bg-secondary-50/25 border-secondary/10 border saturate-125 backdrop-blur-lg rounded-small cursor-grabbing',
        )}>
        {onToggleSelect && (
          <Checkbox
            color="success"
            radius="full"
            isSelected={isSelected}
            isDisabled={draggableProps?.snapshot.isDragging}
            onValueChange={() => onToggleSelect(data, isSelected)}
          />
        )}

        <Button
          isIconOnly
          radius="full"
          variant="flat"
          isDisabled={!onPlay}
          onPress={() => onPlay?.(data)}
          color={isPlaying ? 'success' : 'default'}>
          <PlayIcon className="text-lg" />
        </Button>

        <Cover
          url={data.cover}
          onClick={() => onShowDetails?.(data)}
          className={cn('size-16 mx-3', onShowDetails && 'cursor-pointer')}
        />

        <div className="flex flex-col gap-2 mr-auto">
          <div className="flex items-center gap-2">{meta.title}</div>

          <div className="flex items-center gap-2">
            <PropertyText>
              <ClockIcon /> {meta.duration}
            </PropertyText>

            {meta.album && meta.artist && (
              <>
                <AlbumLink className="pl-2 border-l border-default/30">{meta.album}</AlbumLink>
                <ArtistLink>{meta.artist}</ArtistLink>
              </>
            )}
          </div>
        </div>

        {draggableProps && <GripVerticalIcon className="text-lg text-default-300" />}
      </div>
    )
  },
  (prev, next) =>
    prev.data.hash === next.data.hash &&
    prev.isSelected === next.isSelected &&
    prev.isPlaying === next.isPlaying &&
    prev.index === next.index &&
    prev.draggableProps === next.draggableProps,
)

function ListContainer(props: ListContainerProps) {
  return <div {...props} className="flex flex-col gap-1 px-3 shrink-0 w-full divide-y divide-default/30" />
}

function ListHeader(props: ListHeaderProps) {
  return <div {...props} className="h-[calc(theme(spacing.10)+theme(spacing.16)+theme(spacing.4))]" />
}

export function useTrackSelection() {
  return useSelection<Track>((a, b) => a === b) // compare by reference
}

function parseFilters(params: URLSearchParams) {
  return { album: params.get('album'), artist: params.get('artist') }
}

function getKey(item: Track) {
  return item.hash
}
