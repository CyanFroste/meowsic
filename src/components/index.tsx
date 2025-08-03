import { useQuery } from '@tanstack/react-query'
import { getName, getVersion } from '@tauri-apps/api/app'
import { useStore } from 'zustand'
import {
  cn,
  Checkbox,
  Chip,
  Input,
  Modal,
  Button,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Accordion,
  AccordionItem,
} from '@heroui/react'
import { ArrowRightIcon, SearchIcon } from 'lucide-react'
import { EulaCheckbox, setFirstLaunchVersion, store } from '@/settings'
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
      startContent={<SearchIcon className="text-lg text-default-500 flex-shrink-0 mr-1" />}
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
        'px-6 h-16 flex items-center gap-3 rounded-small absolute top-[calc(theme(spacing.10)+theme(spacing.2))] left-0 right-3',
        'bg-default-50/25 backdrop-blur-lg z-50 backdrop-saturate-125',
        className,
      )}
    />
  )
}

export function HomeScreen() {
  return (
    <div className="p-3 pt-[calc(theme(spacing.10)+theme(spacing.2))] w-full">
      <Player />
    </div>
  )
}

export function FirstLaunchModal() {
  const { firstLaunchVersion } = useStore(store)

  const queryApp = useQuery({
    queryKey: ['app'],
    queryFn: async () => ({ name: await getName(), version: await getVersion() }),
  })

  return (
    <Modal
      radius="sm"
      size="5xl"
      backdrop="blur"
      placement="bottom-center"
      scrollBehavior="inside"
      hideCloseButton
      isDismissable={false}
      isKeyboardDismissDisabled
      isOpen={queryApp.data && firstLaunchVersion !== queryApp.data.version}>
      <ModalContent>
        <ModalHeader className="flex gap-2 text-xl">
          Welcome to <div className="capitalize">{queryApp.data?.name}</div>
        </ModalHeader>

        <ModalBody>
          <Accordion selectionMode="multiple" className="px-0" defaultExpandedKeys={['important', 'new']}>
            <AccordionItem
              key="important"
              title="Important"
              classNames={{ title: 'text-large', content: 'text-small pb-6' }}>
              By proceeding, you affirm that
              <ul className="font-mono leading-relaxed my-3">
                <li>
                  - You will use scraping/streaming features only on content you legally own or are permitted to access.
                </li>
                <li>- You are aware that YouTube prohibits automated download or streaming via unauthorized tools.</li>
                <li>- You accept full responsibility for any resulting legal risk (no warranty).</li>
              </ul>
              If you do not agree to the EULA, you can still use the app, but you will not be able to stream from
              YouTube. <br /> You can also accept the EULA at any time in the app settings.
            </AccordionItem>
            <AccordionItem
              key="new"
              title={"What's new in v" + queryApp.data?.version}
              classNames={{ title: 'text-large' }}></AccordionItem>
          </Accordion>
        </ModalBody>
        <ModalFooter className="justify-between">
          <EulaCheckbox />

          <Button
            radius="sm"
            variant="flat"
            color="success"
            isDisabled={!queryApp.data}
            onPress={() => setFirstLaunchVersion(queryApp.data?.version ?? '')}>
            Proceed <ArrowRightIcon className="text-lg" />
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
