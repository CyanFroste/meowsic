import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardFooter } from '@heroui/react'
import { UserRoundIcon } from 'lucide-react'
import { getArtists } from '@/tracks'
import { Cover } from '@/tracks/components'

export function ArtistsScreen() {
  const query = useQuery({ queryKey: ['artists'], queryFn: getArtists })

  return (
    <div className="pt-[calc(theme(spacing.10))] overflow-auto w-full flex flex-col h-full gap-2">
      <div className="grid grid-cols-8 p-3 shrink-0 w-full gap-0.5">
        {query.isSuccess &&
          query.data.map(item => (
            <Card
              as={Link}
              key={item}
              isFooterBlurred
              radius="none"
              shadow="none"
              to={`/tracks?artist=${item}`}
              className="aspect-square bg-transparent group">
              <Cover className="size-full rounded-none" placeholder={UserRoundIcon} />

              <CardFooter
                className="absolute bg-background/60 bottom-0 z-10 py-2 px-3
                max-h-10 group-hover:max-h-full transition-[max-height]">
                <div className="text-small line-clamp-1 group-hover:line-clamp-none">{item}</div>
              </CardFooter>
            </Card>
          ))}
      </div>
    </div>
  )
}
