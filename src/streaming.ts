import { invoke } from '@tauri-apps/api/core'

export async function loadDependencies() {
  await invoke('streaming_load_dependencies')
}

export async function installDependencies() {
  await invoke('streaming_install_dependencies')
}

export async function scanUrls(urls: string[], wipeSources: string[] = []) {
  return await invoke<string>('streaming_scan_urls', { urls, wipeSources })
}
