import { invoke } from '@tauri-apps/api/core'

export async function loadDependencies() {
  await invoke('streaming_load_dependencies')
}

export async function installDependencies() {
  await invoke('streaming_install_dependencies')
}

export async function search(source: string, query: string) {
  return await invoke<SearchResult[]>('streaming_search', { source, query })
}

export async function scanUrls(urls: string[], wipeSources: string[] = []) {
  return await invoke<string>('streaming_scan_urls', { urls, wipeSources })
}

export async function getDependencies() {
  return await invoke<Dependencies | null>('streaming_get_dependencies')
}

type SearchResult = {
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
