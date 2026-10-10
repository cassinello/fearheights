import type { Metadata } from 'next'
import HomeClient from './HomeClient'

type Props = { searchParams: Promise<{ place?: string | string[]; id?: string | string[] }> }

// Public address of the site. Vercel fills it in; set NEXT_PUBLIC_SITE_URL to force another one.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

const readPlace = (value: string | string[] | undefined) =>
  ((Array.isArray(value) ? value[0] : value) || '').trim().replace(/\s+/g, ' ').slice(0, 80)

// Google place ids only contain letters, digits, - and _
const readId = (value: string | string[] | undefined) => {
  const id = ((Array.isArray(value) ? value[0] : value) || '').trim()
  return /^[A-Za-z0-9_-]{10,300}$/.test(id) ? id : ''
}

// Title, description and preview card (X, WhatsApp, etc.) for each place link
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const place = readPlace(params.place)
  const id = place ? readId(params.id) : ''
  const query = place ? `?place=${encodeURIComponent(place)}${id ? `&id=${id}` : ''}` : ''

  const title = place
    ? `How scary is ${place}? | Fear Heights`
    : 'Fear Heights — How scary is it, really?'
  const description = place
    ? `See the fear-of-heights rating for ${place}, read the reviews and add your own.`
    : 'Rate places by how much they scare you. Search any location and leave your vertigo rating and review.'
  const path = `/${query}`
  const image = `/api/og${query}`

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: 'Fear Heights',
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@_FearHeights',
      title,
      description,
      images: [image],
    },
  }
}

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const place = readPlace(params.place)
  return <HomeClient initialPlace={place} initialPlaceId={place ? readId(params.id) : ''} />
}