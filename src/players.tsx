import { useLayoutEffect, useRef, useState } from 'react'
import { Tooltip, Button, Slider } from '@heroui/react'
import { PlayIcon, PauseIcon } from 'lucide-react'
import { getAssetUrl, normalizeMediaError } from '@/utils'
import type { Track } from '@/tracks'

export class MediaPlayer {
  core: HTMLAudioElement // | HTMLVideoElement
  error: Error | null = null

  constructor(core: HTMLAudioElement) {
    this.core = core

    this.core.addEventListener('error', () => {
      this.error = normalizeMediaError(this.core.error)
    })
  }

  load(src: string | null) {
    this.core.src = src ? getAssetUrl(src) : ''
    this.core.load()
  }

  seek(elapsed: number) {
    this.core.currentTime = elapsed
  }

  async getDuration() {
    return new Promise<number>((resolve, reject) => {
      const resolveData = () => resolve(Math.round(this.core.duration))
      if (!isNaN(this.core.duration)) return resolveData()

      this.core.addEventListener('loadedmetadata', resolveData, { once: true })
      this.core.addEventListener('error', () => reject(normalizeMediaError(this.core.error)), { once: true })
    })
  }

  async play() {
    this.core.play()
  }

  pause() {
    this.core.pause()
  }

  setVolume(volume: number) {
    this.core.volume = volume
  }
}

type PlayButtonProps = { isPaused: boolean; error?: Error | null; current?: Track | null; toggle: () => void }

export function PlayButton({ current, error, isPaused, toggle }: PlayButtonProps) {
  return (
    <div className="relative">
      {error && (
        <Tooltip size="sm" radius="sm" className="bg-danger-100" content={error.message}>
          <div className="absolute inset-0 rounded-full" />
        </Tooltip>
      )}

      <Button
        isIconOnly
        radius="full"
        variant="flat"
        className="size-20"
        color={error ? 'danger' : 'secondary'}
        isDisabled={!current || !!error}
        onPress={toggle}>
        {isPaused ? <PlayIcon className="text-2xl" /> : <PauseIcon className="text-2xl" />}
      </Button>
    </div>
  )
}

type SeekBarProps = {
  elapsed: number
  duration?: number
  className?: string
  isDisabled?: boolean
  onSeek: (elapsed: number) => void
}

export function SeekBar({ elapsed, duration, isDisabled, onSeek }: SeekBarProps) {
  const { progress, setProgress, setIsSeeking } = useSeeker(elapsed)

  return (
    <Slider
      size="sm"
      color="foreground"
      aria-label="Progress"
      isDisabled={isDisabled}
      value={progress}
      maxValue={duration ?? -1}
      onChange={value => {
        setIsSeeking(true)
        setProgress(typeof value === 'number' ? value : value[0])
      }}
      onChangeEnd={value => {
        setIsSeeking(false)
        const pos = typeof value === 'number' ? value : value[0]

        onSeek(pos)
        setProgress(pos)
      }}
    />
  )
}

export function useSeeker(elapsed: number) {
  const [progress, setProgress] = useState(elapsed)
  const [isSeeking, setIsSeeking] = useState(false)
  const prevElapsed = useRef(elapsed)

  useLayoutEffect(() => {
    if (!isSeeking && elapsed !== prevElapsed.current) {
      setProgress(elapsed)
    }

    prevElapsed.current = elapsed
  }, [elapsed, isSeeking])

  return { progress, setProgress, setIsSeeking }
}
