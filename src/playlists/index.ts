import { invoke } from '@tauri-apps/api/core'
import type { Track } from '@/tracks'

export async function getPlaylists() {
  return await invoke<string[]>('db_get_playlists')
}

export async function addPlaylist(name: string) {
  return await invoke('db_add_playlist', { name })
}

export async function renamePlaylist(name: string, newName: string) {
  return await invoke('db_rename_playlist', { name, newName })
}

export async function removePlaylist(name: string) {
  return await invoke('db_remove_playlist', { name })
}

export async function getPlaylistTracks(name: string) {
  return await invoke<Track[]>('db_get_playlist_tracks', { name })
}

export async function addPlaylistTracks(name: string, tracks: Track[]) {
  return await invoke('db_add_playlist_tracks', { name, hashes: tracks.map(t => t.hash) })
}

export async function removePlaylistTracks(name: string, tracks?: Track[] | null) {
  return await invoke('db_remove_playlist_tracks', { name, hashes: tracks?.map(t => t.hash) })
}

export async function reorderPlaylistTrack(name: string, track: Track, src: number, dst: number) {
  return await invoke('db_reorder_playlist_track', { name, hash: track.hash, src, dst })
}
