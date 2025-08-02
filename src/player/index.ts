import { createStore, useStore } from 'zustand'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { addToast } from '@heroui/react'
import { Interval } from '@/utils'
import { rankUp } from '@/emotions'
import { getTrackPathType } from '@/tracks'
import { setMiniPlayerVisibility, setPlayerMaximized } from '@/settings'
import { BackendPlayer, WebPlayer } from '@/player/types'
import type { ShortcutHandler } from '@tauri-apps/plugin-global-shortcut'
import type { Track } from '@/tracks'
import type { Player } from '@/player/types'

const backendPlayer = new BackendPlayer()
const webPlayer = new WebPlayer()
const interval = new Interval(1000, onElapsed)

function initialState(): Store {
  return {
    queue: [],
    current: 0,
    elapsed: 0,
    isPaused: true,
    repeat: null,
    template: null,
    isShuffled: false,
    backupQueue: [],
    player: backendPlayer,
    loading: null,
  }
}

export const store = createStore<Store>(initialState)

// this contains the core logic for all the navigations and context switching
export async function goto(index: number, using?: Player) {
  const state = store.getState()
  if (!state.isPaused) interval.stop()

  const track = state.queue[index]
  const player = using ?? backendPlayer

  store.setState({ loading: track })

  // case: stop the previous player
  if (player !== state.player) state.player.stop()

  try {
    const promise = player.goto(index)

    // case: show a toast when loading from external sources
    if (getTrackPathType(track.path)[0] === 'l')
      addToast({
        title: track.title ?? track.name,
        promise,
        color: 'warning',
        severity: 'success',
        // TODO: show a formatted Card with the track info
        description: `Fetching Track from ${track.path}`,
        shouldShowTimeoutProgress: true,
        timeout: 1000,
      })

    await promise

    if (!state.isPaused) interval.start()

    // case: replace with metadata from the web player
    let queue = state.queue

    try {
      if (player instanceof WebPlayer) {
        const newQueue = Array.from(queue)
        const duration = await player.getDuration()

        newQueue[index].duration = duration
        queue = newQueue
      }

      // case: continue the playback if the player is not paused while navigating
      if (!state.isPaused) await player.play()
    } catch (err) {
      interval.stop()
      throw err
    }

    store.setState({ current: index, queue, elapsed: 0, error: null, player, loading: null })
  } catch (err) {
    console.error(err, track)

    // case: fallback to web player once if backend fails
    if (!using) return await goto(index, webPlayer)

    const error = err as Error // since backend response have similar type
    store.setState({ current: index, elapsed: 0, error, loading: null })

    addToast({ timeout: 5000, title: 'Track', description: error.message, color: 'danger' })
  }
}

export async function seek(elapsed: number) {
  const state = store.getState()
  if (state.elapsed === elapsed) return

  if (!state.isPaused) interval.stop()
  await state.player.seek(elapsed)
  if (!state.isPaused) interval.start()

  store.setState({ elapsed })
}

export async function pause() {
  const state = store.getState()
  if (state.isPaused || state.error) return

  interval.stop()
  await state.player.pause()

  store.setState({ isPaused: true })
}

export async function play() {
  const state = store.getState()
  if (!state.isPaused || state.error) return

  await state.player.play()
  interval.start()

  store.setState({ isPaused: false })
}

export async function playTracks(data: Track | Track[], from = 0) {
  const queue = Array.isArray(data) ? data : [data]
  // TODO: error handling (handling in the consumer side for now)
  // if (!queue.length) throw new Error('No tracks to play')

  await setQueue(queue)
  store.setState({ queue, isShuffled: false, backupQueue: [] })

  await goto(from)
  await play()
}

export async function shuffle() {
  const state = store.getState()
  const current = state.queue.at(state.current)
  if (state.isShuffled) return

  const shuffled = state.queue.toSorted(() => Math.random() - 0.5)
  const index = shuffled.findIndex(it => it === current)
  const backupQueue = state.queue

  await setCurrent(index)
  await setQueue(shuffled)

  store.setState({ isShuffled: true, backupQueue, current: index, queue: shuffled })
}

export async function unshuffle() {
  const state = store.getState()
  const current = state.queue.at(state.current)
  if (!state.isShuffled) return

  const original = state.backupQueue
  const index = original.findIndex(it => it === current)

  await setCurrent(index)
  await setQueue(original)

  store.setState({ isShuffled: false, backupQueue: [], current: index, queue: original })
}

export async function reset() {
  await setQueue([])
  await setCurrent(0)
  await stop()

  interval.stop()
  store.setState(initialState())
}

function onElapsed() {
  const state = store.getState()
  const current = state.queue.at(state.current)

  if (!current) return reset()
  if (state.elapsed >= current.duration) return next()

  store.setState(state => ({ elapsed: state.elapsed + 1 }))

  // n seconds before the end, not awaiting the promise
  if (isEmotionRankingAllowed(state.template) && current.duration - state.elapsed === 10) {
    rankUp(current)
  }
}

async function playArbitraryTracks(data: Track | Track[]) {
  await playTracks(Array.isArray(data) ? data : [data])
  setTemplate('arbitrary')

  setPlayerMaximized(true)
  setMiniPlayerVisibility(true)
}

export async function next() {
  const state = store.getState()
  const index = getNextIndex(state)

  if (index === -1) return await reset()
  await goto(index)
}

export async function prev() {
  const state = store.getState()
  const index = getPrevIndex(state)

  if (index === -1) return await reset()
  await goto(index)
}

export function setTemplate(template: Template | null) {
  store.setState({ template })
}

export function setRepeat(repeat: Repeat | null) {
  store.setState({ repeat })
}

export async function extendQueue(tracks: Track[]) {
  const state = store.getState()

  // NOTE: not comparing by reference because the tracks can be from different sources
  const filtered = tracks.filter(track => !state.queue.some(it => it.hash === track.hash))
  const queue = state.queue.concat(filtered)

  await setQueue(queue)
  store.setState({ queue })
}

async function stop() {
  await backendPlayer.stop()
  await webPlayer.stop()
}

async function setQueue(queue: Track[]) {
  await backendPlayer.setQueue(queue)
  await webPlayer.setQueue(queue)
}

async function setCurrent(index: number) {
  await backendPlayer.setCurrent(index)
  await webPlayer.setCurrent(index)
}

export async function setVolume(volume: number) {
  await backendPlayer.setVolume(volume)
  await webPlayer.setVolume(volume)
}

export function usePlayer() {
  const state = useStore(store)

  // TODO: remove standalone functions
  return {
    setState: store.setState,
    toggleShuffle: state.isShuffled ? unshuffle : shuffle,
    togglePlay: state.isPaused ? play : pause,
    current: state.queue.at(state.current),
    isRepeatCurrent: isRepeatCurrent(state.repeat),
    hasPrev: getPrevIndex(state) >= 0,
    hasNext: getNextIndex(state) >= 0,
    isShuffled: state.isShuffled,
    isPaused: state.isPaused,
    elapsed: state.elapsed,
    repeat: state.repeat,
    queue: state.queue,
    error: state.error,
    setTemplate,
    setCurrent,
    playTracks,
    setVolume,
    setRepeat,
    setQueue,
    reset,
    pause,
    seek,
    goto,
    next,
    prev,
    stop,
    play,
  }
}

async function getArbitraryTracks() {
  return await invoke<Track[]>('player_get_arbitrary_tracks')
}

export async function init() {
  listen<Track>('play-arbitrary-track', async evt => {
    await playArbitraryTracks(evt.payload)
  })

  const tracks = await getArbitraryTracks()
  if (!tracks.length) return

  await playArbitraryTracks(tracks)
}

type GetIndexParams = Pick<Store, 'queue' | 'current' | 'repeat'>

export function getNextIndex({ queue, current, repeat }: GetIndexParams) {
  if (isRepeatCurrent(repeat)) return current
  if (queue.length > current + 1) return current + 1
  return repeat ? 0 : -1
}

export function getPrevIndex({ queue, current, repeat }: GetIndexParams) {
  if (isRepeatCurrent(repeat)) return current
  if (current > 0) return current - 1
  return repeat ? queue.length - 1 : -1
}

export function isRepeatCurrent(repeat: Repeat | null) {
  return repeat?.[0] === 'c'
}

export function isEmotionRankingAllowed(template?: Template | null) {
  return !template // || (template[0] !== 'e' && template[0] !== 'a')
}

export const onGlobalShortcut: ShortcutHandler = evt => {
  if (evt.state === 'Released') return
  const state = store.getState()

  switch (evt.shortcut) {
    case 'MediaPlayPause':
      return state.isPaused ? play() : pause()

    case 'MediaTrackNext':
      return next()

    case 'MediaTrackPrevious':
      return prev()

    case 'MediaStop':
      return reset()
  }
}

export type Template = 'emotions' | 'arbitrary'

export type Repeat = 'current' | 'all'

export type Store = {
  queue: Track[]
  current: number
  elapsed: number
  isPaused: boolean
  repeat: Repeat | null
  template: Template | null
  isShuffled: boolean
  // backup queue for reverting shuffle
  backupQueue: Track[]
  error?: Error | null
  player: Player
  loading?: Track | null
}
