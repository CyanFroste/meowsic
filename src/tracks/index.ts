import { invoke } from '@tauri-apps/api/core'
import MiniSearch from 'minisearch'
import { formatTime } from '@/utils'

export type Track = {
  hash: string
  path: string
  name: string
  extension: string
  duration: number
  source: string
  cover?: string | null
  title?: string | null
  artist?: string | null
  album?: string | null
  albumArtist?: string | null
  date?: string | null
  genre?: string | null
  position?: number | null
  rank?: number | null
  rules?: string | null
}

type GetTracksFilters = {
  artist?: string | null
  album?: string | null
}

export type Album = { name: string; cover?: string | null }

export async function getTracks(filters: GetTracksFilters = {}) {
  return await invoke<Track[]>('db_get_tracks', { filters })
}

export async function getAlbums() {
  return await invoke<Album[]>('db_get_albums')
}

export async function getArtists() {
  return await invoke<string[]>('db_get_artists')
}

export function normalizeMeta(track?: Track | null) {
  return {
    duration: formatTime(track?.duration),
    title: track?.title ?? track?.name,
    artist: track?.artist,
    album: track?.album,
    albumArtist: track?.albumArtist,
    date: track?.date,
    genre: track?.genre,
  }
}

export function createSearchIndex() {
  return new MiniSearch({
    idField: 'hash',
    fields: ['title', 'name', 'album', 'artist', 'genre'],
    storeFields: ['hash'],
    searchOptions: { boost: { title: 2 }, prefix: true, fuzzy: true },
  })
}

export function getTrackPathType(path: string) {
  return path.startsWith('http') ? 'link' : 'file'
}
