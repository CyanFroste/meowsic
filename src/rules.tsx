import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Input, Button, Accordion, AccordionItem } from '@heroui/react'
import { TrashIcon, PlusIcon, XIcon, CheckIcon } from 'lucide-react'
import type { Track } from '@/tracks'

type RulesEditorProps = { track: Track; values: string[]; setValues: (values: string[]) => void }

export function RulesEditor({ track, values, setValues }: RulesEditorProps) {
  useEffect(() => setValues(track.rules?.split('\n') ?? []), [track.rules])

  return (
    <div className="flex flex-col gap-3 items-start w-120">
      {values.map((value, index) => {
        const parsed = parseRule(value, track)

        return (
          <div key={index} className="flex items-center gap-2 w-full">
            <Input
              radius="sm"
              variant="flat"
              placeholder="Provide a Rule"
              value={value}
              onValueChange={value => {
                const newValues = [...values]
                newValues[index] = value
                setValues(newValues)
              }}
              endContent={parsed ? <CheckIcon className="text-success-500" /> : <XIcon className="text-danger-500" />}
              classNames={{
                input: 'bg-transparent placeholder:text-default-300 font-mono',
                innerWrapper: 'bg-transparent',
                inputWrapper: [
                  'dark:bg-default/30',
                  'dark:hover:bg-default/40',
                  'dark:group-data-[focus=true]:bg-default/40',
                ],
              }}
            />

            <Button
              isIconOnly
              size="sm"
              radius="sm"
              color="danger"
              variant="light"
              className="text-default-500"
              onPress={() => {
                const newValues = [...values]
                newValues.splice(index, 1)
                setValues(newValues)
              }}>
              <TrashIcon className="text-lg" />
            </Button>
          </div>
        )
      })}

      <Button
        size="sm"
        radius="sm"
        variant="flat"
        onPress={() => {
          const newValues = [...values]
          newValues.push('')
          setValues(newValues)
        }}>
        <PlusIcon className="text-medium" /> Add Rule
      </Button>

      <Accordion className="mt-10">
        <AccordionItem key="usage" title="Usage">
          <div className="text-default-500 text-small font-mono whitespace-pre-wrap">{DESCRIPTION}</div>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

export function validateRules(rules: string | string[] | null, track: Track) {
  if (!rules) return ''

  let values = Array.isArray(rules) ? rules : rules.split('\n')
  let valid: string = ''

  for (const value of values) {
    const p = parseRule(value, track)
    if (!p) continue

    valid += value
    valid += '\n'
  }

  return valid
}

export async function setRules(track: Track, rules: string | null = '') {
  // NOTE: user is allowed to set empty rules
  return await invoke('db_set_rules', { hash: track.hash, rules })
}

function parseRule(rule: string, track: Track): Rule | null {
  const parts = rule.split(' ').filter(Boolean)
  if (parts[0] !== 'at') return null

  const trigger = parseTime(parts[1])
  if (trigger === null) return null

  switch (parts[2]) {
    case 'goto': {
      if (parts[3] === 'next') return { trigger, action: 'seek', param: track.duration }

      const param = parseTime(parts[3])
      if (param === null) return null

      return { trigger, action: 'seek', param }
    }

    case 'seek': {
      const param = parseInt(parts[3])
      if (isNaN(param)) return null

      return { trigger, action: 'seek', param: trigger + param }
    }

    case 'volume': {
      const param = parseInt(parts[3])
      if (isNaN(param)) return null

      return { trigger, action: 'volume', param }
    }

    default:
      return null
  }
}

export function parseRules(track: Track | null) {
  if (!track?.rules) return []

  return track.rules
    .split('\n')
    .map(it => parseRule(it, track))
    .filter(Boolean) as Rule[]
}

export type Rule = { trigger: number; action: 'seek' | 'volume'; param: number }

const TIME_REGEX = /^(?:(\d{1,2}):)?([0-5]?\d):([0-5]?\d)$|^([0-5]?\d)$/

function parseTime(value: string) {
  if (!value && value !== '0') return null

  const match = value.match(TIME_REGEX)
  if (!match) return null

  const [, hh, mm, ss, solo] = match
  let hours = 0,
    minutes = 0,
    seconds = 0

  if (solo || solo === '0') {
    seconds = parseInt(solo, 10)
  } else {
    hours = hh ? parseInt(hh, 10) : 0
    minutes = parseInt(mm, 10)
    seconds = parseInt(ss, 10)
  }

  return hours * 3600 + minutes * 60 + seconds
}

type UseExecuteRulesOptions = {
  elapsed: number
  track: Track | null
  seek: (elapsed: number) => void
  setVolume: (volume: number) => void
  enabled?: boolean
}

export function useExecuteRules({ track, elapsed, seek, setVolume, enabled = true }: UseExecuteRulesOptions) {
  // NOTE: each rule is executed once per track
  // if you play the same track from the same source, the rules will be skipped
  // because the track reference is the same

  const rules = useRef<Map<string, Rule>>(new Map())
  const prevElapsed = useRef(elapsed)

  const parse = () =>
    !track
      ? new Map()
      : parseRules(track).reduce((map, rule) => map.set(`${track.hash}-${rule.trigger}`, rule), new Map())

  const reset = () => {
    rules.current = parse()
  }

  useEffect(reset, [track])

  // setQueue (global) -> seek (here) -> goto (global)
  // there's a sync issue b/w track change, seek and goto again changing track and setting elapsed to 0 directly
  // also, adding the same song from anywhere won't reparse rules

  useEffect(() => {
    if (!enabled || !rules.current.size || !track) {
      prevElapsed.current = elapsed
      return
    }

    const key = `${track.hash}-${elapsed}`
    const rule = rules.current.get(key)

    switch (rule?.action) {
      case 'seek': {
        const value = Math.min(Math.max(rule.param, 0), track.duration)

        if (value === elapsed) break
        seek(value)

        // NOTE: workaround for seek sync issue, this will case a seekbar jump
        // also, this won't cause the rule to be deleted when it jumps back
        if (prevElapsed.current !== elapsed) rules.current.delete(key)
        break
      }

      case 'volume':
        const value = Math.min(Math.max(rule.param, 0), 100)
        setVolume(value)

        rules.current.delete(key)
        break
    }

    prevElapsed.current = elapsed
  }, [enabled, elapsed, track])

  return { reset }
}

// TODO: speed rules

const DESCRIPTION = ` 
Syntax

at hh:mm:ss goto    hh:mm:ss
at hh:mm:ss goto    next
at hh:mm:ss seek    +/-ss
at hh:mm:ss volume  n

- hh and mm are optional, ss is required
- mm and ss cannot be greater than 59
- no duplicate trigger times or rules

Examples

at 1:10  goto    2:10      
at 3:10  goto    next
at 8     seek   +10
at 2:08  seek   -28
at 0:40  volume  60
`
