import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/supabase'

// Preview image for links shared on X and other apps: /api/og?place=Burj Khalifa

const LABELS = [
  'If heights scare you, run away!',
  'Heights alert, proceed with caution!',
  'Some heights, but manageable',
  "A little elevation, but you're good!",
  'Totally chill, no heights to fear!',
]

const CREAM = '#f5ede0'
const STAR = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'

const likeExact = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const place = (params.get('place') || '').trim().replace(/\s+/g, ' ').slice(0, 80)
  const rawId = (params.get('id') || '').trim()
  const id = /^[A-Za-z0-9_-]{10,300}$/.test(rawId) ? rawId : ''

  let avg: number | null = null
  let count = 0

  if (place) {
    try {
      // Ratings saved with the Google id, plus older ones saved by name only
      let byName = supabase.from('fear_ratings').select('id, score').ilike('location', likeExact(place))
      if (id) byName = byName.is('place_id', null)
      const results = await Promise.all(
        id ? [byName, supabase.from('fear_ratings').select('id, score').eq('place_id', id)] : [byName]
      )
      const rows = new Map<string, number>()
      for (const r of results) for (const row of r.data ?? []) rows.set(String(row.id), row.score)
      if (rows.size > 0) {
        count = rows.size
        avg = [...rows.values()].reduce((sum, s) => sum + s, 0) / count
      }
    } catch {
      // If the database cannot be reached, the card is drawn without a rating
    }
  }

  const rounded = avg !== null ? Math.min(5, Math.max(1, Math.round(avg))) : 0
  const headline = place || 'Rate places by how much they scare you'
  const size = headline.length <= 18 ? 96 : headline.length <= 32 ? 76 : headline.length <= 50 ? 60 : 48

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: '#7b8fc7', color: CREAM, padding: '56px 70px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 44 }}>Fear Heights</div>
          <div style={{ display: 'flex', fontSize: 26, opacity: 0.8 }}>How scary is it, really?</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: size, lineHeight: 1.1 }}>{headline}</div>
          {rounded > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30 }}>
              <div style={{ display: 'flex' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <svg key={n} width="64" height="64" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                    <path d={STAR} fill={CREAM} fillOpacity={n <= rounded ? 1 : 0.28} />
                  </svg>
                ))}
              </div>
              <div style={{ display: 'flex', fontSize: 38, marginTop: 14 }}>{LABELS[rounded - 1]}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 38, marginTop: 30, opacity: 0.9 }}>
              {place ? 'Not rated yet. Would you dare?' : 'Search any location and leave your vertigo rating.'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, opacity: 0.85 }}>
          <div style={{ display: 'flex' }}>
            {count > 0 ? `${count} ${count === 1 ? 'rating' : 'ratings'}` : place ? 'Be the first to rate it' : 'Stay grounded!'}
          </div>
          <div style={{ display: 'flex' }}>@_FearHeights</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // Refresh the card every hour so the rating stays reasonably current
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    }
  )
}