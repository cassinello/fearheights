import type { Metadata } from 'next'
import HomeClient from './HomeClient'

type Props = { searchParams: Promise<{ place?: string | string[] }> }

// Public address of the site. Vercel fills it in; set NEXT_PUBLIC_SITE_URL to force another one.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

const readPlace = (value: string | string[] | undefined) =>
  ((Array.isArray(value) ? value[0] : value) || '').trim().replace(/\s+/g, ' ').slice(0, 80)

// Title, description and preview card (X, WhatsApp, etc.) for each place link
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const place = readPlace((await searchParams).place)

  const title = place
    ? `How scary is ${place}? | Fear Heights`
    : 'Fear Heights — How scary is it, really?'
  const description = place
    ? `See the fear-of-heights rating for ${place}, read the reviews and add your own.`
    : 'Rate places by how much they scare you. Search any location and leave your vertigo rating and review.'
  const path = place ? `/?place=${encodeURIComponent(place)}` : '/'
  const image = place ? `/api/og?place=${encodeURIComponent(place)}` : '/api/og'

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
  const place = readPlace((await searchParams).place)
  return <HomeClient initialPlace={place} />
}