import './styles.css'

window.addEventListener('error', evt => {
  // case: Virtuoso's resize observer can throw this error,
  // which is caught by DnD and aborts dragging.
  if (
    evt.message === 'ResizeObserver loop completed with undelivered notifications.' ||
    evt.message === 'ResizeObserver loop limit exceeded'
  ) {
    evt.stopImmediatePropagation()
  }
})

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  register as registerGlobalShortcut,
  isRegistered as isGlobalShortcutRegistered,
} from '@tauri-apps/plugin-global-shortcut'
import { ToastProvider } from '@heroui/react'
import { init as initPlayer, onGlobalShortcut as onPlayerGlobalShortcut } from '@/player'
import { Window } from '@/components/window'
import { HomeScreen } from '@/components'
import { TracksScreen } from '@/tracks/components'
import { TrackScreen } from '@/tracks/components/details'
import { PlaylistsScreen, PlaylistScreen } from '@/playlists/components'
import { EmotionsScreen, EmotionScreen } from '@/emotions/components'
import { StreamingScreen, StreamYouTubeScreen } from '@/streaming/components'
import { QueueScreen } from '@/queue'
import { AlbumsScreen } from '@/albums'
import { ArtistsScreen } from '@/artists'
import { SettingsScreen, init as initSettings } from '@/settings'

const currentWindow = getCurrentWindow()

const router = createBrowserRouter([
  {
    path: '/',
    Component: Window,
    children: [
      { path: '/', Component: HomeScreen },
      { path: '/queue', Component: QueueScreen },
      { path: '/tracks', Component: TracksScreen },
      { path: '/tracks/:hash', Component: TrackScreen },
      { path: '/playlists', Component: PlaylistsScreen },
      { path: '/playlists/:name', Component: PlaylistScreen },
      { path: '/emotions', Component: EmotionsScreen },
      { path: '/emotions/:name', Component: EmotionScreen },
      { path: '/albums', Component: AlbumsScreen },
      { path: '/artists', Component: ArtistsScreen },
      { path: '/settings', Component: SettingsScreen },
      { path: '/streaming', Component: StreamingScreen },
      { path: '/streaming/youtube', Component: StreamYouTubeScreen },
    ],
  },
])

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 2 * 60 * 1000, refetchOnMount: 'always' },
  },
})

await initSettings()
await initPlayer()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />

      <ToastProvider
        toastOffset={40}
        placement="top-center"
        toastProps={{ radius: 'sm', classNames: { description: 'whitespace-pre-wrap not-empty:pt-1' } }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
)

try {
  await currentWindow.show()
  await currentWindow.setFocus()
} catch {
  await currentWindow.close()
}

document.addEventListener('contextmenu', evt => {
  if (import.meta.env.PROD) evt.preventDefault()
})

window.addEventListener('keydown', evt => {
  if (import.meta.env.PROD && evt.ctrlKey && evt.key.toLowerCase() === 'r') evt.preventDefault()
})

{
  const keys = ['MediaTrackNext', 'MediaTrackPrevious', 'MediaPlayPause', 'MediaStop']
  const promises = await Promise.all(keys.map(isGlobalShortcutRegistered))

  if (!promises.every(Boolean)) await registerGlobalShortcut(keys, onPlayerGlobalShortcut)
}
