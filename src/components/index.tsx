import { cn, Checkbox, Chip, Input } from '@heroui/react'
import { SearchIcon } from 'lucide-react'
import { Player } from '@/player/components'
import type { UseSelection } from '@/utils'

type SearchBarProps = { value: string; onChange: (value: string) => void; className?: string }

export function SearchBar({ value, onChange, className }: SearchBarProps) {
  return (
    <Input
      radius="sm"
      variant="flat"
      placeholder="Search"
      value={value}
      onValueChange={onChange}
      onClear={() => onChange('')}
      startContent={<SearchIcon className="text-lg text-default-500 shrink-0 mr-1" />}
      classNames={{
        // TODO: ? make this solid depending on background
        base: className,
        input: 'bg-transparent placeholder:text-default-300',
        innerWrapper: 'bg-transparent',
        inputWrapper: ['dark:bg-default/30', 'dark:hover:bg-default/40', 'dark:group-data-[focus=true]:bg-default/40'],
      }}
    />
  )
}

type SelectAllControlsProps<T> = { data: T[]; selection: UseSelection<T> }

export function SelectAllControls<T>({ selection, data }: SelectAllControlsProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        color="success"
        radius="full"
        isSelected={selection.values.length === data.length}
        onValueChange={() => {
          if (selection.values.length === data.length) return selection.clear()
          selection.set(data)
        }}
      />

      <Chip variant="flat" onClose={selection.clear} classNames={{ base: 'shrink-0 font-mono', closeButton: 'mx-0.5' }}>
        {selection.values.length}
      </Chip>
    </div>
  )
}

export function AppBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'px-6 h-16 flex items-center gap-3 rounded-small absolute top-[calc(--spacing(10)+(--spacing(2)))] left-0 right-3',
        'bg-default-50/25 backdrop-blur-lg z-50 backdrop-saturate-125',
        className,
      )}
    />
  )
}

export function HomeScreen() {
  return (
    <div className="p-3 pt-[calc(--spacing(10)+(--spacing(2)))] w-full">
      <Player />
    </div>
  )
}
