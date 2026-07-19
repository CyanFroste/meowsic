import { memo, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Card, CardFooter } from '@heroui/react'
import { Disc3Icon } from 'lucide-react'
import MiniSearch from 'minisearch'
import chunk from 'lodash.chunk'
import { useDebounce } from 'use-debounce'
import { getAlbums } from '@/tracks'
import { useSelection } from '@/utils'
import { AppBar, SearchBar } from '@/components'
import { VirtualList } from '@/components/lists'
import { Cover } from '@/tracks/components/details'
import type { Album } from '@/tracks'
import type {
  ContainerProps as ListContainerProps,
  HeaderProps as ListHeaderProps,
  FooterProps as ListFooterProps,
} from '@/components/lists'

const searchIndex = createSearchIndex()

export function AlbumsScreen() {
  const navigate = useNavigate()
  const chunkSize = 8 // TODO: probably make this change with screen size

  const query = useQuery({ queryKey: ['albums'], queryFn: getAlbums })

  const map = new Map(query.data?.map(it => [it.name, it]) ?? [])
  const [filtered, setFiltered] = useState(chunk(query.data, chunkSize))

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery] = useDebounce(searchQuery, 500)

  useEffect(() => {
    if (!debouncedSearchQuery.trim()) return setFiltered(chunk(query.data, chunkSize))

    const data = searchIndex
      .search(debouncedSearchQuery)
      .map(it => map.get(it.id))
      .filter(Boolean) as Album[]

    setFiltered(chunk(data, chunkSize))
  }, [query.data, debouncedSearchQuery])

  useEffect(() => {
    searchIndex.removeAll()
    searchIndex.addAll(query.data ?? [])
  }, [query.data])

  const selection = useAlbumSelection()

  return (
    <div className="flex flex-col size-full relative">
      <AppBar>
        <SearchBar value={searchQuery} onChange={setSearchQuery} className="w-120 ml-auto" />
      </AppBar>

      <VirtualList data={filtered} components={{ Container: ListContainer, Header: ListHeader, Footer: ListFooter }}>
        {items => (
          <ListItem
            // first item's name as key because each album is unique
            key={items[0].name}
            data={items}
            columns={chunkSize}
            isSelected={items.map(it => selection.isSelected(it))}
            onToggleSelect={selection.toggle}
            onOpen={data => navigate(`/tracks?album=${data.name}`)}
          />
        )}
      </VirtualList>
    </div>
  )
}

type ListItemProps = {
  data: Album[]
  columns: number
  isSelected?: boolean[]
  onOpen: (data: Album) => void
  onToggleSelect?: (data: Album, previouslySelected?: boolean) => void
}

export const ListItem = memo(
  ({ data, onOpen, columns }: ListItemProps) => {
    return (
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {data.map(item => {
          return (
            <Card
              key={item.name}
              radius="none"
              shadow="none"
              isFooterBlurred
              className="aspect-square bg-transparent group isolate">
              {/* {onToggleSelect && (
                <Checkbox
                  color="success"
                  radius="full"
                  isSelected={isSelected?.[index]}
                  onValueChange={() => onToggleSelect(item, isSelected?.[index])}
                  classNames={{ base: 'absolute top-2 left-2 z-12', wrapper: 'bg-background/80 mr-0' }}
                />
              )} */}

              <Cover
                className="size-full rounded-none"
                url={item.cover}
                placeholder={Disc3Icon}
                onClick={() => onOpen(item)}
              />

              <CardFooter
                className="absolute bg-background/60 bottom-0 z-10 py-2 px-3
                max-h-10 group-hover:max-h-full transition-[max-height]">
                <div className="text-small line-clamp-1 group-hover:line-clamp-none">{item.name}</div>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    )
  },
  (prev, next) =>
    prev.onOpen === next.onOpen &&
    prev.columns === next.columns &&
    prev.data.length === next.data.length &&
    prev.isSelected?.length === next.isSelected?.length &&
    !!prev.data.every((it, i) => it === next.data[i]) &&
    !!prev.isSelected?.every((it, i) => it === next.isSelected?.[i]),
)

function ListContainer(props: ListContainerProps) {
  return <div {...props} className="flex flex-col gap-0.5 px-3 pb-3 shrink-0 w-full" />
}

function ListHeader(props: ListHeaderProps) {
  return <div {...props} className="h-[calc(--spacing(10)+(--spacing(16))+(--spacing(4)))]" />
}

function ListFooter(props: ListFooterProps) {
  return <div {...props} className="h-3" />
}

export function useAlbumSelection() {
  return useSelection<Album>((a, b) => a === b) // compare by reference
}

export function createSearchIndex() {
  return new MiniSearch({
    idField: 'name',
    fields: ['name'],
    storeFields: ['name'],
    searchOptions: { prefix: true, fuzzy: true },
  })
}
