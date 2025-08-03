import { Link } from 'react-router'
import { Card, CardFooter, Image } from '@heroui/react'

export function StreamingScreen() {
  return (
    <div className="pt-[calc(theme(spacing.10)+theme(spacing.2))] overflow-auto size-full flex flex-col gap-2">
      <div className="flex h-full items-center mx-auto">
        <Card as={Link} to="/streaming/youtube" radius="sm" className="size-60" isPressable>
          <Image removeWrapper className="pt-8 w-1/2 m-auto object-contain" src="/icons/yt-logo.png" />
          <CardFooter className="text-white justify-center w-full">YouTube</CardFooter>
        </Card>
      </div>
    </div>
  )
}

export function StreamYouTubeScreen() {
  return (
    <div className="pt-[calc(theme(spacing.10)+theme(spacing.2))] overflow-auto size-full flex flex-col gap-2"></div>
  )
}
