import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { createStore, useStore } from 'zustand'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  cn,
  Image,
  ModalFooter,
  Button,
  Tab,
  Tabs,
  ScrollShadow,
  addToast,
  useDisclosure,
} from '@heroui/react'
import {
  CalendarIcon,
  ClockIcon,
  Disc3Icon,
  HeartIcon,
  MusicIcon,
  PencilLineIcon,
  SearchIcon,
  TagIcon,
  UserRoundIcon,
} from 'lucide-react'
import { getAssetUrl } from '@/utils'
import { normalizeMeta } from '@/tracks'
import {
  PlainLyricsView,
  SyncedLyricsView,
  LyricsEditorModal,
  getLyrics,
  setLyrics,
  searchExternalLyrics,
} from '@/lyrics'
import { useScrubPlayer } from '@/scrub-player'
import { ScrubPlayer } from '@/scrub-player/components'
import { getRules, RulesEditor, setRules, useExecuteRules } from '@/rules'
import type { LucideIcon } from 'lucide-react'
import type { Track } from '@/tracks'
import type { Lyrics } from '@/lyrics'
import type { RulesEditorHandle } from '@/rules'

export function TrackDetailsModal() {
  const { data, hide } = useTrackDetails()
  const meta = normalizeMeta(data)

  return (
    <Modal isOpen={!!data} onClose={hide} placement="bottom-center" backdrop="blur" radius="sm" size="3xl">
      <ModalContent>
        <ModalHeader>Track Details</ModalHeader>

        <ModalBody className="flex flex-col gap-3">
          <div className="flex w-full gap-3">
            <Cover url={data?.cover} className="size-60 shrink-0" />

            <div className="flex flex-col gap-2">
              {meta.title && <div className="text-large">{meta.title}</div>}

              {meta.album && <AlbumLink onClick={hide}>{meta.album}</AlbumLink>}
              {meta.artist && <ArtistLink onClick={hide}>{meta.artist}</ArtistLink>}

              <PropertyText className="mb-auto">
                <ClockIcon /> {meta.duration}
              </PropertyText>

              {meta.genre && (
                <PropertyText>
                  <TagIcon /> {meta.genre}
                </PropertyText>
              )}

              {meta.date && (
                <PropertyText>
                  <CalendarIcon /> {meta.date}
                </PropertyText>
              )}
            </div>
          </div>

          <MoreDetails data={data} className="py-3" />
        </ModalBody>

        <ModalFooter>
          <Button as={Link} radius="sm" variant="flat" isDisabled={!data} to={`/tracks/${data?.hash}`} onPress={hide}>
            Manage
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

async function getTrack(hash: string) {
  return await invoke<Track | null>('db_get_track', { hash })
}

type CoverProps = {
  url?: string | null
  className?: string
  placeholder?: LucideIcon | (() => React.ReactNode)
  external?: boolean
  onClick?: () => void
}

export function Cover({ url, className, placeholder: Placeholder = MusicIcon, external, onClick }: CoverProps) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      {...(onClick && { type: 'button', onClick, disabled: !onClick })}
      className={cn('rounded-small overflow-hidden', onClick && 'cursor-pointer', className)}>
      {url ? (
        <Image
          isBlurred
          radius="none"
          shadow="none"
          width="100%"
          height="100%"
          loading="lazy"
          src={external ? url : getAssetUrl(url)}
          classNames={{ wrapper: 'size-full', img: 'size-full object-contain' }}
        />
      ) : (
        <div className="size-full grid place-items-center bg-radial from-secondary-50/75 to-default-50/25">
          <Placeholder className="size-1/3 text-secondary-800 opacity-80" />
        </div>
      )}
    </Component>
  )
}

type PropertyTextProps = { link?: string; children: React.ReactNode; className?: string; onClick?: () => void }

export function PropertyText({ link, children, className, onClick }: PropertyTextProps) {
  const Component = link ? Link : 'div'

  return (
    <Component
      to={link ?? ''}
      onClick={onClick}
      className={cn(
        'text-default-500 flex items-center gap-2 text-small',
        link && 'hover:text-secondary-700 transition-colors cursor-pointer',
        className,
      )}>
      {children}
    </Component>
  )
}

export function AlbumLink({ children, ...props }: PropertyTextProps) {
  return (
    <PropertyText {...props} link={`/tracks?album=${children}`}>
      <Disc3Icon /> {children}
    </PropertyText>
  )
}

export function ArtistLink({ children, ...props }: PropertyTextProps) {
  return (
    <PropertyText {...props} link={`/tracks?artist=${children}`}>
      <UserRoundIcon /> {children}
    </PropertyText>
  )
}

type MoreDetailsProps = { data: Track | null; className?: string }

export function MoreDetails({ data, className }: MoreDetailsProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Pair label="File Name" value={data?.name} />
      <Pair label="File Path" value={data?.path} />
      <Pair label="Hash" value={data?.hash} />
      <Pair label="Extension" value={data?.extension} />
      {data?.rank && <Pair label="Emotion Rank" value={data.rank} />}
    </div>
  )
}

type PairProps = { label: string; value?: string | number | null }

function Pair({ label, value }: PairProps) {
  return (
    <div className="flex items-center text-default-500 text-tiny">
      <div className="w-36 shrink-0">{label}</div>
      <div className="break-all">{value ?? '-'}</div>
    </div>
  )
}

const store = createStore<Track | null>(() => null)

export function useTrackDetails() {
  const state = useStore(store)

  return {
    data: state,
    show: (data: Track) => store.setState(data),
    hide: () => store.setState(null),
  }
}

export function TrackScreen() {
  const params = useParams<{ hash: string }>()
  const player = useScrubPlayer()
  const [tab, setTab] = useState('lyrics')
  const [selectedLyrics, setSelectedLyrics] = useState<Lyrics | null>(null)
  const rulesEditor = useRef<RulesEditorHandle>(null)
  const enterLyricsModal = useDisclosure()

  const query = useQuery({
    queryKey: ['track', params.hash],
    queryFn: async () => await getTrack(params.hash!),
    enabled: !!params.hash,
  })

  useEffect(() => {
    ;(async () => {
      if (!query.data) return

      await player.setCurrent(query.data)
      await player.start(query.data)
      await player.pause()
    })()
  }, [query.data])

  const queryExternalLyrics = useQuery({
    queryKey: ['search-external-lyrics', player.current?.hash],
    queryFn: async () => await searchExternalLyrics(player.current!),
    enabled: false,
  })

  const queryLyrics = useQuery({
    queryKey: ['lyrics', player.current?.hash],
    queryFn: async () => await getLyrics(player.current!),
    enabled: !!player.current,
  })

  const mutationSaveLyrics = useMutation({
    mutationFn: async (lyrics: Lyrics) => {
      if (!player.current) return
      await setLyrics(player.current, lyrics)
    },
    onSuccess: async () => {
      const res = await queryLyrics.refetch()
      if (res.isSuccess) setSelectedLyrics(res.data)
      addToast({ color: 'success', title: 'Lyrics Saved' })
    },
  })

  const queryRules = useQuery({
    queryKey: ['rules', player.current?.hash],
    queryFn: async () => await getRules(player.current!),
    enabled: !!player.current,
  })

  const mutationSaveRules = useMutation({
    mutationFn: async (rules: string | null) => {
      if (!player.current) return
      await setRules(player.current, rules)
    },
    onSuccess: () => {
      queryRules.refetch()
      addToast({ color: 'success', title: 'Rules Saved' })
    },
  })

  useExecuteRules({
    data: queryRules.data ?? '',
    track: player.current,
    elapsed: player.elapsed,
    seek: player.seek,
    setVolume: () => {}, // TODO: set volume for scrub player
  })

  return (
    <div className="pt-[calc(theme(spacing.10))] overflow-auto size-full flex flex-col">
      {query.isSuccess && query.data && (
        <div className="pt-3 flex flex-col gap-6 h-full overflow-auto">
          <div className="w-full rounded-small pt-3 bg-default-50/25 shrink-0 px-6">
            <div className="w-4/5 mx-auto">
              <ScrubPlayer />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 px-3">
            <Tabs variant="underlined" selectedKey={tab} onSelectionChange={key => setTab(key as string)}>
              <Tab key="lyrics" title="Lyrics" />
              <Tab key="rules" title="Rules" />
              <Tab key="more" title="More Details" />
            </Tabs>

            {tab[0] !== 'm' && <div className="h-5 border-r border-default/30 mr-3" />}

            {tab[0] === 'l' && (
              <>
                {queryExternalLyrics.isSuccess && queryExternalLyrics.data.length > 0 && (
                  <Button
                    size="sm"
                    radius="sm"
                    variant="flat"
                    isDisabled={!selectedLyrics || selectedLyrics === queryLyrics.data}
                    onPress={() => mutationSaveLyrics.mutate(selectedLyrics!)}>
                    <HeartIcon className="text-medium" /> Save Selected Lyrics
                  </Button>
                )}

                <Button
                  size="sm"
                  radius="sm"
                  variant="flat"
                  isLoading={queryExternalLyrics.isFetching}
                  onPress={() => queryExternalLyrics.refetch()}>
                  <SearchIcon className="text-medium" /> Search Online
                </Button>

                <Button size="sm" radius="sm" variant="flat" onPress={enterLyricsModal.onOpen}>
                  <PencilLineIcon className="text-medium" /> Enter Lyrics
                </Button>

                <LyricsEditorModal
                  disclosure={enterLyricsModal}
                  onSave={(value, isSynced) => {
                    mutationSaveLyrics.mutate(isSynced ? { synced: value, plain: '' } : { synced: '', plain: value })
                  }}
                />
              </>
            )}

            {tab[0] === 'r' && (
              <Button
                size="sm"
                radius="sm"
                variant="flat"
                onPress={() => mutationSaveRules.mutate(rulesEditor.current?.value ?? null)}>
                <HeartIcon className="text-medium" /> Save Rules
              </Button>
            )}
          </div>

          {tab[0] === 'l' && (
            <div className="flex gap-3 h-full overflow-auto px-6">
              <ScrollShadow className="flex flex-col gap-1 shrink-0 pr-3 pb-3">
                <Button
                  size="sm"
                  radius="sm"
                  isDisabled={!queryLyrics.data}
                  className="text-small justify-start shrink-0"
                  onPress={() => setSelectedLyrics(queryLyrics.data!)}
                  variant={selectedLyrics === queryLyrics.data ? 'flat' : 'light'}>
                  Currently Saved
                </Button>

                {queryExternalLyrics.isSuccess &&
                  queryExternalLyrics.data.map((item, index) => (
                    <Button
                      size="sm"
                      radius="sm"
                      key={index + 1}
                      className="text-small justify-start shrink-0"
                      onPress={() => setSelectedLyrics(item)}
                      variant={selectedLyrics === item ? 'flat' : 'light'}>
                      Online {index + 1}
                    </Button>
                  ))}
              </ScrollShadow>

              {selectedLyrics &&
                (!selectedLyrics.synced ? (
                  <PlainLyricsView data={selectedLyrics.plain} className="size-full" />
                ) : (
                  <SyncedLyricsView
                    data={selectedLyrics.synced}
                    elapsed={player.elapsed}
                    duration={player.current?.duration}
                    onSeek={player.seek}
                    className="size-full"
                  />
                ))}
            </div>
          )}

          {tab[0] === 'r' && player.current && (
            <div className="h-full overflow-auto px-6 pb-3">
              <RulesEditor data={queryRules.data ?? ''} track={player.current} ref={rulesEditor} />
            </div>
          )}

          {tab[0] === 'm' && <MoreDetails data={player.current} className="px-6" />}
        </div>
      )}
    </div>
  )
}
