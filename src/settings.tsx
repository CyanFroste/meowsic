import { useState } from 'react'
import {
  Accordion,
  AccordionItem,
  addToast,
  Button,
  Image,
  Code,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Slider,
  useDisclosure,
} from '@heroui/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { getName, getVersion } from '@tauri-apps/api/app'
import { revealItemInDir, openUrl } from '@tauri-apps/plugin-opener'
import { open } from '@tauri-apps/plugin-dialog'
import { createStore, useStore } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  CheckIcon,
  DatabaseBackupIcon,
  FileScanIcon,
  HeartIcon,
  ListRestartIcon,
  PlusIcon,
  ShieldAlertIcon,
  XIcon,
} from 'lucide-react'
import { setVolume as setPlayerVolume } from '@/player'
import { installDependencies, loadDependencies, scanUrls } from '@/streaming'

const FONTS = ['Inter', 'Poppins', 'Merriweather', 'Dancing Script']

export const DEFAULT_EMOTION = 'Neutral'

export function SettingsScreen() {
  const state = useStore(store)
  const [fontSize, setFontSize] = useState(state.fontSize)
  const resetModal = useDisclosure()

  const queryDirs = useQuery({ queryKey: ['dirs'], queryFn: getDirs })

  const queryApp = useQuery({
    queryKey: ['app'],
    queryFn: async () => ({ name: await getName(), version: await getVersion() }),
  })

  const mutationScan = useMutation({
    mutationFn: scanDirs,
    onError: err => addToast({ timeout: 5000, color: 'danger', title: err.message }),
    onSuccess: result => {
      addToast({
        timeout: 5000,
        title: 'Folders Scanned',
        description: result.trim(),
        color: result.startsWith('[ERR]') ? 'danger' : 'success',
      })
    },
  })

  const mutationBackup = useMutation({
    mutationFn: async (dir: string) => await backup(dir),
    onError: err => addToast({ timeout: 5000, color: 'danger', title: err.message }),
    onSuccess: path => {
      addToast({
        timeout: 5000,
        color: 'success',
        title: 'Backup Created',
        endContent: (
          <Button radius="sm" variant="flat" color="success" onPress={() => revealItemInDir(path)}>
            Locate
          </Button>
        ),
      })
    },
  })

  const mutationRestore = useMutation({
    mutationFn: async (path: string) => await restore(path),
    onError: err => addToast({ timeout: 5000, color: 'danger', title: err.message }),
    onSuccess: () => {
      addToast({ timeout: 5000, color: 'success', title: 'Backup Restored' })
    },
  })

  const mutationReset = useMutation({
    mutationFn: reset,
    onSettled: resetModal.onClose,
    onError: err => addToast({ timeout: 5000, color: 'danger', title: err.message }),
    onSuccess: () => {
      addToast({ timeout: 5000, color: 'success', title: 'Database Reset' })
      queryDirs.refetch()
    },
  })

  return (
    <div className="p-3 pt-[calc(theme(spacing.10)+theme(spacing.3))] overflow-auto w-full">
      <div className="flex flex-col items-start gap-3">
        <div className="text-large mt-2">Folders to Scan</div>

        <div className="text-small mb-2 text-default-500">Select the folders that have your audio files.</div>

        {queryDirs.isSuccess && queryDirs.data.length > 0 && (
          <div className="flex flex-col gap-3 p-3 bg-default-50/25 rounded-small">
            {queryDirs.data.map(dir => (
              <div key={dir} className="flex items-center w-100 pl-2">
                <div className="text-default-500 font-mono">{dir}</div>

                <Button
                  isIconOnly
                  size="sm"
                  radius="full"
                  color="danger"
                  variant="light"
                  className="ml-auto shrink-0"
                  onPress={async () => {
                    await setDirs(queryDirs.data.filter(d => d !== dir))
                    await queryDirs.refetch()
                  }}>
                  <XIcon className="text-medium !text-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="flat"
          radius="sm"
          onPress={async () => {
            const selected = await open({ directory: true })
            if (selected) await setDirs([...(queryDirs.data ?? []), selected])
            await queryDirs.refetch()
          }}>
          <PlusIcon className="text-lg" /> Add Folder
        </Button>

        <Button
          variant="flat"
          radius="sm"
          isLoading={mutationScan.isPending}
          isDisabled={!queryDirs.data?.length}
          onPress={() => mutationScan.mutate()}>
          <FileScanIcon className="text-lg" /> Scan
        </Button>

        <hr className="w-full mt-3 border-default/30" />
        <div className="text-large mt-2">External Sources</div>

        <div className="text-small mb-4 text-default-500">
          To stream and save tracks from external sources, you need to install the dependencies first.
          <br /> This will download the latest version of <Code>yt-dlp</Code> and <Code>ffmpeg</Code>.
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="flat"
            radius="sm"
            onPress={async () => {
              await installDependencies()
              console.log('Dependencies installed')
            }}>
            Install Dependencies
          </Button>
        </div>

        <hr className="w-full mt-3 border-default/30" />
        <div className="text-large my-2">Appearance</div>

        <Slider
          size="sm"
          label="Size"
          color="foreground"
          minValue={12}
          maxValue={24}
          getValue={value => `${value}px`}
          classNames={{ base: 'w-64 mb-2', labelWrapper: 'mb-1' }}
          value={fontSize}
          onChangeEnd={() => store.setState({ fontSize })}
          onChange={value => setFontSize(typeof value === 'number' ? value : value[0])}
        />

        <Select
          label="Font"
          radius="sm"
          labelPlacement="outside"
          popoverProps={{ classNames: { content: 'rounded-small' } }}
          classNames={{ base: 'w-64', trigger: 'dark:bg-default/30 dark:hover:bg-default/40', listbox: 'px-0' }}
          selectedKeys={[state.fontFamily]}
          onSelectionChange={value => {
            const fontFamily = value.currentKey
            if (!fontFamily) return

            store.setState({ fontFamily })
          }}>
          {FONTS.map(font => (
            <SelectItem key={font}>{font}</SelectItem>
          ))}
        </Select>

        <hr className="w-full mt-3 border-default/30" />

        <Accordion className="px-0" defaultExpandedKeys={['list']}>
          <AccordionItem key="list" title="Key Bindings" classNames={{ title: 'text-large', trigger: 'py-2' }}>
            <KeyBindings />
          </AccordionItem>
        </Accordion>

        <hr className="w-full mt-3 border-default/30" />
        <div className="text-large mt-2">Data Management</div>

        <div className="text-small mb-4 text-default-500">
          Backup and Restore your Playlists, Emotion, Lyrics and Rules as a zip file.
          <br /> You can also reset your data to a clean state.
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="flat"
            radius="sm"
            isLoading={mutationBackup.isPending}
            onPress={async () => {
              const selected = await open({ directory: true })
              if (selected) mutationBackup.mutate(selected)
            }}>
            <DatabaseBackupIcon className="text-lg" /> Backup
          </Button>

          <Button
            variant="flat"
            radius="sm"
            isLoading={mutationBackup.isPending}
            onPress={async () => {
              const selected = await open({
                defaultPath: 'meowsic_backup.zip',
                filters: [{ name: 'Backup', extensions: ['zip'] }],
              })

              if (selected) mutationRestore.mutate(selected)
            }}>
            <ListRestartIcon className="text-lg" /> Restore
          </Button>

          <Button variant="flat" radius="sm" color="danger" onPress={() => resetModal.onOpen()}>
            <ShieldAlertIcon className="text-lg" /> Reset
          </Button>
        </div>

        <Modal
          radius="sm"
          backdrop="blur"
          placement="bottom-center"
          isOpen={resetModal.isOpen}
          onOpenChange={resetModal.onOpenChange}>
          <ModalContent>
            <ModalHeader className="text-danger-300 tracking-wider">RESET</ModalHeader>

            <ModalBody>
              Are you sure you want to reset all your data?
              <div className="text-small text-default-500">
                This will remove all your Tracks, Playlists, Emotions, Lyrics and Rules to start over from scratch and
                write new ones. <br /> <br />
                Your Tracks won't be deleted from your device. You can scan the folders again to add them back.
              </div>
            </ModalBody>

            <ModalFooter>
              <Button
                radius="sm"
                variant="flat"
                isLoading={mutationReset.isPending}
                onPress={() => mutationReset.mutate()}
                color="danger">
                <CheckIcon className="text-lg" /> Confirm
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <hr className="w-full mt-3 border-default/30" />
        <div className="text-large my-2">Contribute</div>

        <Button
          radius="sm"
          variant="flat"
          className="self-start"
          title="Sponsor CyanFroste"
          onPress={() => openUrl('https://github.com/sponsors/CyanFroste')}>
          <HeartIcon className="text-lg text-pink-400" /> Sponsor
        </Button>

        <hr className="w-full mt-3 border-default/30" />
        <div className="text-large my-2">About</div>

        {queryApp.isSuccess && (
          <div className="flex flex-col text-default-500 text-small">
            <Image removeWrapper src="/icons/logo.png" width={88} height={88} className="mb-6" />

            <div className="text-medium text-foreground mb-0.5">
              <span className="capitalize">{queryApp.data.name}</span> v{queryApp.data.version}
            </div>

            <div>© {new Date().getFullYear()} Cyan Froste</div>

            <div className="text-tiny my-3">
              Licensed under Apache <br /> License 2.0 SPDX-License-Identifier: Apache-2.0
            </div>

            <button
              onClick={() => openUrl('https://github.com/CyanFroste/meowsic/blob/master/LICENSE')}
              className="self-start text-secondary-700 mb-6 cursor-pointer">
              View full license
            </button>

            <Button
              radius="sm"
              variant="flat"
              className="self-start"
              onPress={() => openUrl('https://github.com/CyanFroste/meowsic')}>
              <img height="24" width="24" src="https://cdn.simpleicons.org/github/white" className="size-6" />
              View source code
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

async function scanDirs() {
  return await invoke<string>('db_scan_dirs')
}

async function setDirs(dirs: string[]) {
  return await invoke('db_set_dirs', { dirs })
}

async function getDirs() {
  return await invoke<string[]>('db_get_dirs')
}

async function backup(dir: string) {
  return await invoke<string>('db_backup', { dir })
}

async function restore(path: string) {
  return await invoke('db_restore', { path })
}

async function reset() {
  return await invoke('db_reset')
}

type Store = {
  currentEmotion: string
  isPlayerMaximized: boolean
  isMiniPlayerVisible: boolean
  fontFamily: string
  fontSize: number
  volume: number
}

// had to put this in a fn because false is not assignable to boolean? WTF?
function initialState(): Store {
  return {
    currentEmotion: DEFAULT_EMOTION,
    isPlayerMaximized: false,
    isMiniPlayerVisible: false,
    fontFamily: 'Poppins',
    fontSize: 16,
    volume: 1,
  }
}

export const store = createStore<Store>()(
  persist(initialState, {
    name: 'settings',
    partialize: ({ isMiniPlayerVisible: _, isPlayerMaximized: __, ...state }) => state,
  }),
)

export function setPlayerMaximized(isMaximized: boolean) {
  store.setState({ isPlayerMaximized: isMaximized })
}

export function setMiniPlayerVisibility(isVisible: boolean) {
  store.setState({ isMiniPlayerVisible: isVisible })
}

export async function setEmotion(name: string) {
  store.setState({ currentEmotion: name })
}

store.subscribe(init)

function applyTheme({ fontFamily, fontSize }: Store = store.getState()) {
  document.documentElement.style.setProperty('--font-mono', 'JetBrains Mono')
  document.documentElement.style.setProperty('--font-sans', fontFamily)
  document.documentElement.style.setProperty('font-size', `${fontSize}px`)
}

export async function init(state = store.getState()) {
  applyTheme(state)
  await setPlayerVolume(state.volume)
}

function KeyBindings() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="w-28 shrink-0">
          <Code>P</Code>
        </div>
        <div className="text-small">Toggle Play and Pause</div>
      </div>
      <div className="flex items-center">
        <div className="w-28 shrink-0">
          <Code>F</Code>
        </div>
        <div className="text-small">Toggle Player Fullscreen</div>
      </div>
      <div className="flex items-center">
        <div className="w-28 shrink-0">
          <Code>B</Code>
        </div>
        <div className="text-small">Toggle Mini Player</div>
      </div>
      <div className="flex items-center">
        <div className="w-28 shrink-0">
          <Code>Ctrl + H</Code>
        </div>
        <div className="text-small">Show Player and enter Player Fullscreen</div>
      </div>
      <div className="flex items-center">
        <div className="w-28 shrink-0">
          <Code>V</Code>
        </div>
        <div className="text-small">Show volume controls</div>
      </div>
      <div className="flex items-center">
        <div className="w-28 shrink-0">
          <Code>Esc</Code>
        </div>
        <div className="text-small">Exit Player Fullscreen (use to close modals and other popups as well)</div>
      </div>
    </div>
  )
}
