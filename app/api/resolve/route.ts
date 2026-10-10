// Finds the Google Maps place that matches what the visitor typed:
// /api/resolve?q=scokjan cabes  ->  { place: { id, name: "Škocjan Caves", address } }
// Uses Places API (New) Text Search with a server-only key (GOOGLE_PLACES_KEY).

type Place = { id: string; name: string; address: string }

// Small per-server memory so repeated searches don't call Google again
const cache = new Map<string, Place | null>()

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim().replace(/\s+/g, ' ').slice(0, 120)
  if (!q) return Response.json({ error: 'Empty search' }, { status: 400 })

  const key = process.env.GOOGLE_PLACES_KEY
  if (!key) return Response.json({ error: 'GOOGLE_PLACES_KEY is not set' }, { status: 503 })

  const cacheKey = q.toLowerCase()
  if (cache.has(cacheKey)) return Response.json({ place: cache.get(cacheKey) })

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: q, languageCode: 'en' }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      console.error('Places API error', res.status, detail)
      return Response.json({ error: 'Google Places error', status: res.status, detail }, { status: 502 })
    }

    const json = await res.json()
    const first = json.places?.[0]
    const place: Place | null = first?.id
      ? { id: first.id, name: first.displayName?.text || q, address: first.formattedAddress || '' }
      : null

    if (cache.size >= 500) cache.clear()
    cache.set(cacheKey, place)
    return Response.json({ place })
  } catch (e) {
    console.error('Places API unreachable', e)
    return Response.json({ error: 'Google Places unreachable' }, { status: 502 })
  }
}