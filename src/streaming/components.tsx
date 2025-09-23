import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useStore } from 'zustand'
import { Button, Card, CardFooter, Image } from '@heroui/react'
import { setMiniPlayerVisibility, setPlayerMaximized, store } from '@/settings'
import { usePlayer } from '@/player'
import { searchYouTube, getYouTubeTracks, tracksFromYouTubeSearchResults } from '@/streaming'
import { SearchBar } from '@/components'
import type { YouTubeSearchResult } from '@/streaming'

export function StreamingScreen() {
  const navigate = useNavigate()
  const { isEulaAccepted } = useStore(store)

  return (
    <div className="pt-[calc(theme(spacing.10)+theme(spacing.2))] overflow-auto size-full flex flex-col gap-2">
      <div className="flex h-full items-center mx-auto">
        <Card
          radius="sm"
          className="size-60"
          isDisabled={!isEulaAccepted}
          isPressable={isEulaAccepted}
          onPress={() => {
            if (isEulaAccepted) navigate('/streaming/youtube')
          }}>
          <Image removeWrapper className="pt-8 w-1/2 m-auto object-contain" src="/icons/yt-logo.png" />
          <CardFooter className="text-white justify-center w-full">YouTube</CardFooter>
        </Card>
      </div>
    </div>
  )
}

export function StreamYouTubeScreen() {
  const player = usePlayer()
  const [searchQuery, setSearchQuery] = useState('')

  const query = useQuery({
    queryKey: ['streaming-youtube-search', searchQuery],
    queryFn: () => searchYouTube(searchQuery),
    enabled: false,
    placeholderData: [
      {
        channel: 'itsRucka',
        duration: 226,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/bEeZlhsDxkg/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLD0ZZQ3JI9tACLzrh-uWpBOX3MNgA',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/bEeZlhsDxkg/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC0qjjUqVarmt-Bq32UKIuMA_fzEA',
            width: 720,
          },
        ],
        title: 'Bing Bong',
        url: 'https://www.youtube.com/watch?v=bEeZlhsDxkg',
        views: 11834,
      },
      {
        channel: 'itsRucka',
        duration: 231,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/BzWIKZ2hbus/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCTXRWP_BXPYj1mXDJFFZr6Wu8OwQ',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/BzWIKZ2hbus/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDsUqUrWqwr0rm4xyvoZDYXMC0dzg',
            width: 720,
          },
        ],
        title: 'Baby Baby Baby Oil ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=BzWIKZ2hbus',
        views: 1677249,
      },
      {
        channel: 'itsRucka',
        duration: 269,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/UJwUYLhxr5w/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCpVKXQct1jeo4xBSZ29ikYypQTuQ',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/UJwUYLhxr5w/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLA2z1twHRELEXnRAauxTN5U84lTYw',
            width: 720,
          },
        ],
        title: "I'm Osama (animated) ~ Rucka Rucka Ali",
        url: 'https://www.youtube.com/watch?v=UJwUYLhxr5w',
        views: 5131875,
      },
      {
        channel: 'itsRucka',
        duration: 189,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/pc4aIMwKV4k/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDsbDHZwc8cWVCSOWLkJ-C5U0ZYRA',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/pc4aIMwKV4k/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLClhCGxbIEfVlem2ahP1bNRo-uRpg',
            width: 720,
          },
        ],
        title: 'Treat Jew Better (animated) ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=pc4aIMwKV4k',
        views: 3773755,
      },
      {
        channel: 'itsRucka',
        duration: 306,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/4uZXbpLMm6I/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBV9ykOhSI_SqKjypd5b2848WOMmA',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/4uZXbpLMm6I/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDpUqFWsk3DjCleMHwGA2NNsR6ghg',
            width: 720,
          },
        ],
        title: 'Free P Diddy! We Built This City Parody ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=4uZXbpLMm6I',
        views: 80600,
      },
      {
        channel: 'itsRucka',
        duration: 222,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/mDvnZiCOPqw/hq720.jpg?sqp=-oaymwE2COgCEMoBSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB_gmAAtAFigIMCAAQARh_ID0oGDAP&rs=AOn4CLBiZBOUy0NKFTKTT2Y8KpP6_2nN-A',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/mDvnZiCOPqw/hq720.jpg?sqp=-oaymwE2CNAFEJQDSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB_gmAAtAFigIMCAAQARh_ID0oGDAP&rs=AOn4CLA8xr0Ued66ddDhH4mYvnta0oOAiA',
            width: 720,
          },
        ],
        title: 'Call Me Maybe PARODY "My Name\'s Obama" ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=mDvnZiCOPqw',
        views: 9912457,
      },
      {
        channel: 'itsRucka',
        duration: 276,
        thumbnails: [
          {
            height: 270,
            url: 'https://i.ytimg.com/vi/uFSfEw6gYsU/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLD3a90pF1WjXv7E46mGMT4IO4Larw',
            width: 480,
          },
        ],
        title: 'Emo (Like a Nazi) ~ Parody of Lady Gaga Paparazzi  ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=uFSfEw6gYsU',
        views: 5438647,
      },
      {
        channel: 'itsRucka',
        duration: 208,
        thumbnails: [
          {
            height: 270,
            url: 'https://i.ytimg.com/vi/PblG_PtUGQI/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBYj42JB2ITUiQtBEW2l1G57J1qnw',
            width: 480,
          },
        ],
        title: 'FGL ft Nelly "Cruise" PARODY Kim Jong Un Song ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=PblG_PtUGQI',
        views: 16267204,
      },
      {
        channel: 'itsRucka',
        duration: 238,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/1YEatC1v8Rs/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB-CnhV08qEWSsbnwHg6x47iSQHuA',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/1YEatC1v8Rs/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB_8qzMkrUKjCCt992CrqqzNiovUQ',
            width: 720,
          },
        ],
        title: 'Dear White People (Despacito Parody) ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=1YEatC1v8Rs',
        views: 16988762,
      },
      {
        channel: 'itsRucka',
        duration: 215,
        thumbnails: [
          {
            height: 270,
            url: 'https://i.ytimg.com/vi/J4PuF4tPTdA/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCqz_TEGEgK6DNz2LnYEoGgp2atPg',
            width: 480,
          },
        ],
        title: 'Go Cops! (parody of Kesha "Tik Tok") ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=J4PuF4tPTdA',
        views: 6795755,
      },
      {
        channel: 'itsRucka',
        duration: 237,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/ROxKXh7Uv3Y/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCX_LtENY3BtO-phnJAr7YIdSsByg',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/ROxKXh7Uv3Y/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC0YUjxb7PWPYuSouR1j_wl4ysNeA',
            width: 720,
          },
        ],
        title: 'Toto "Africa" PARODY ~ Aids in Africa (animated) ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=ROxKXh7Uv3Y',
        views: 330500,
      },
      {
        channel: 'itsRucka',
        duration: 318,
        thumbnails: [
          {
            height: 270,
            url: 'https://i.ytimg.com/vi/P8XjcK06UXo/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC_owIDyXaqMYluC8vw8Q2PEi_vKw',
            width: 480,
          },
        ],
        title: 'Ima Korean (I Gotta Feeling Parody) ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=P8XjcK06UXo',
        views: 4564313,
      },
      {
        channel: 'itsRucka',
        duration: 327,
        thumbnails: [
          {
            height: 270,
            url: 'https://i.ytimg.com/vi/qnxDslfsAy4/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCrkcpOfTJakMSIVn7l3bikZNXsZA',
            width: 480,
          },
        ],
        title: 'Adele "Hello" PARODY Herro ~ Rucka Rucka Ali & DJ Not Nice',
        url: 'https://www.youtube.com/watch?v=qnxDslfsAy4',
        views: 9985611,
      },
      {
        channel: 'itsRucka',
        duration: 278,
        thumbnails: [
          {
            height: 270,
            url: 'https://i.ytimg.com/vi/Rw4BCniDqD0/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBXYuNPy2g3htuMcBHO14QTlU4bsg',
            width: 480,
          },
        ],
        title: 'Thrift Shop PARODY "I\'m Obama" ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=Rw4BCniDqD0',
        views: 7823849,
      },
      {
        channel: 'itsRucka',
        duration: 214,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/FM9GU1VQZm4/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAAGTS3ID0E2ksbteO70DhqeV34Mw',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/FM9GU1VQZm4/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCZT39BwpDhq-vJhsWdgEazyyV7eQ',
            width: 720,
          },
        ],
        title: 'TRUMP (animated) 2024 ~ Parody of Shawn Mendes "Stitches"  ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=FM9GU1VQZm4',
        views: 1163907,
      },
      {
        channel: 'itsRucka',
        duration: 246,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/NzXRDgy5npg/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB3jxe8D0aTbVTPOLN560hXI8hmTg',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/NzXRDgy5npg/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCyV2WoVWCNmOhou2bNyCRN52cZyQ',
            width: 720,
          },
        ],
        title: "I'm Just a Teenage Mutant, Ninja ~ (animated) ~ Rucka Rucka Ali",
        url: 'https://www.youtube.com/watch?v=NzXRDgy5npg',
        views: 210311,
      },
      {
        channel: 'itsRucka',
        duration: 242,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/04SqRgzeRrw/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDbU7s42fMkAGpaB0fYu0fpzJGJPw',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/04SqRgzeRrw/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAJK1CdvYf_Zgu1q_5uaFKEFRPjXg',
            width: 720,
          },
        ],
        title: "I'm in the Illuminati (Shape of You PARODY) ~ Rucka Rucka Ali",
        url: 'https://www.youtube.com/watch?v=04SqRgzeRrw',
        views: 6828534,
      },
      {
        channel: 'itsRucka',
        duration: 210,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/q0p9h1CFb-I/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAc3fSDZtsAu-dO2Ie3_0z3DlzHaA',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/q0p9h1CFb-I/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBmYOhd714ebvGBhjhiGpbQ4xZksA',
            width: 720,
          },
        ],
        title: '1 Up! ~~ Mario song ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=q0p9h1CFb-I',
        views: 3481584,
      },
      {
        channel: 'itsRucka',
        duration: 196,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/F-8ZX8Eu6EY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCmquSm52Ew-rA5SmvTkuyy2vtf_w',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/F-8ZX8Eu6EY/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCMnsvsXCkvk-zxpADLSslucevsLQ',
            width: 720,
          },
        ],
        title: 'Sweet But Psycho PARODY Michael ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=F-8ZX8Eu6EY',
        views: 1408194,
      },
      {
        channel: 'itsRucka',
        duration: 203,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/4SfzjECEiaM/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCFpW-FRH9E--pjmI_VQ-h1j0i8Aw',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/4SfzjECEiaM/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDMUchmkl_tGE80e6vvJ-r-Ti_b_w',
            width: 720,
          },
        ],
        title: 'Top G ~ Parody of Gayle abcedfu ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=4SfzjECEiaM',
        views: 1912295,
      },
      {
        channel: 'iamRucka',
        duration: 208,
        thumbnails: [
          {
            height: 270,
            url: 'https://i.ytimg.com/vi/N_SjltEm_LQ/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCqUUUFLXvZqig87I7wPYbtrVyitA',
            width: 480,
          },
        ],
        title: 'Prince Ali Obama ~ Aladdin Parody ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=N_SjltEm_LQ',
        views: 461822,
      },
      {
        channel: 'itsRucka',
        duration: 229,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/MI7PYe_1vw8/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDQrEU2ZLGEESHvgxm-7HMdnI_GTA',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/MI7PYe_1vw8/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC8uyufWXbDxRVq4X6sKnJHG4tplw',
            width: 720,
          },
        ],
        title: 'Ching Chang Chong (Parody of "Boom Boom Pow" by Black Eye Peas) ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=MI7PYe_1vw8',
        views: 747493,
      },
      {
        channel: 'itsRucka',
        duration: 187,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/exmTL9WNxtI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBK-FKpeNl8W7mvux3TGlL3vYUkew',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/exmTL9WNxtI/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDrh6sBUD1lbaDL28buiF6HhK7WQg',
            width: 720,
          },
        ],
        title: "I'm Racist (In No Way Whatsoever) ~ Sam Hunt Parody ~ Rucka Rucka Ali",
        url: 'https://www.youtube.com/watch?v=exmTL9WNxtI',
        views: 2817090,
      },
      {
        channel: 'RuckaNuckaAli',
        duration: 227,
        thumbnails: [
          {
            height: 270,
            url: 'https://i.ytimg.com/vi/--oWc1QCXUI/hqdefault.jpg?sqp=-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgBzgWAAuADigIMCAAQARg9IE0ocjAP&rs=AOn4CLDUMvIr4MN3_m-UGUkKIM0jVIsMYQ',
            width: 480,
          },
        ],
        title: 'Rucka Rucka Ali - Eff Australia',
        url: 'https://www.youtube.com/watch?v=--oWc1QCXUI',
        views: 75744,
      },
      {
        channel: 'itsRucka',
        duration: 267,
        thumbnails: [
          {
            height: 202,
            url: 'https://i.ytimg.com/vi/gO8UsF4XoxM/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLD2VtICcayBUP1-aFtPFFmSj0DeWg',
            width: 360,
          },
          {
            height: 404,
            url: 'https://i.ytimg.com/vi/gO8UsF4XoxM/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDMJMLxHm3K_r_uU8aGgxAY7bvJbg',
            width: 720,
          },
        ],
        title: 'Adolf\'s Paradise ~ Coolio "Gangsta\'s Paradise" PARODY ~ Rucka Rucka Ali',
        url: 'https://www.youtube.com/watch?v=gO8UsF4XoxM',
        views: 3353099,
      },
    ],
  })

  const onPlay = async (data: YouTubeSearchResult[]) => {
    // const tracks = await getYouTubeTracks(urls)
    const tracks = tracksFromYouTubeSearchResults(data)

    await player.playTracks(tracks)
    player.setTemplate(null)

    setPlayerMaximized(true)
    setMiniPlayerVisibility(true)
  }

  return (
    <div className="pt-[calc(theme(spacing.10)+theme(spacing.2))] pb-12 overflow-auto w-full flex flex-col h-full gap-2">
      <div
        className="px-6 py-3 flex items-center gap-3 rounded-small
        sticky top-0 inset-x-0 bg-default-50/25 backdrop-blur-lg z-50 backdrop-saturate-125">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        <Button radius="sm" variant="flat" className="px-20 shrink-0" onPress={() => query.refetch()}>
          Search
        </Button>
      </div>

      <div className="grid grid-cols-6 gap-x-6 gap-y-12 px-3 w-full">
        {query.isSuccess &&
          query.data.map(item => <YouTubeCard key={item.url} data={item} onPlay={() => onPlay([item])} />)}
      </div>
    </div>
  )
}

type YouTubeCardProps = { data: YouTubeSearchResult; onPlay: () => void }

function YouTubeCard({ data, onPlay }: YouTubeCardProps) {
  const thumbnail = data.thumbnails[0]?.url

  return (
    <div className="flex flex-col">
      <Image src={thumbnail} radius="sm" width="100%" className="object-cover" onClick={onPlay} />

      <div className="mt-2 mb-1">{data.title}</div>
      <div className="text-small text-default-500">{data.channel}</div>
    </div>
  )
}
