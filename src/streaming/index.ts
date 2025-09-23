import { invoke } from '@tauri-apps/api/core'
import type { Track } from '@/tracks'

export async function loadDependencies() {
  await invoke('streaming_load_dependencies')
}

export async function installDependencies() {
  await invoke('streaming_install_dependencies')
}

export async function searchYouTube(query: string) {
  return await invoke<YouTubeSearchResult[]>('streaming_search', { source: 'youtube', query })
}

export async function getYouTubeTracks(urls: string[]) {
  return await invoke<Track[]>('streaming_get_tracks', { source: 'youtube', urls })
}

export async function scanUrls(urls: string[], wipeSources: string[] = []) {
  return await invoke<string>('streaming_scan_urls', { urls, wipeSources })
}

export async function getDependencies() {
  return await invoke<Dependencies | null>('streaming_get_dependencies')
}

export function tracksFromYouTubeSearchResults(data: YouTubeSearchResult[]): Track[] {
  return data.map(item => ({
    hash: item.url.replaceAll('/', '_'),
    path: item.url,
    name: item.title,
    source: 'youtube',
    extension: 'unknown',
    title: item.title,
    duration: item.duration,
    cover: item.thumbnails[0]?.url,
  }))
}

export type YouTubeSearchResult = {
  url: string
  title: string
  duration: number
  views: number
  channel: string
  thumbnails: { url: string; width: number; height: number }[]
}

// using snake_case for names
type Dependencies = {
  yt_dlp: string
  ffmpeg: string
}
