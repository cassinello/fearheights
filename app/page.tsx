'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const STAR_LABELS = [
  'If heights scare you, run away! 😱',
  'Heights alert, proceed with caution! 😨',
  'Some heights, but manageable 🤔',
  "A little elevation, but you're good! 😊",
  'Totally chill, no heights to fear! 😎'
]

export default function Home() {
  const [location, setLocation] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [feedback, setFeedback] = useState('Search a location to rate it!')
  const [avgScore, setAvgScore] = useState<number | null>(null)
  const [totalRatings, setTotalRatings] = useState(0)
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewText, setReviewText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)

  const loadMap = async (loc: string) => {
    if (!mapRef.current) return
    const { Loader } = await import('@googlemaps/js-api-loader')
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
      version: 'weekly',
    })
    await loader.importLibrary('maps')
    const geocoder = new (window as any).google.maps.Geocoder()
    geocoder.geocode({ address: loc }, (results: any, status: any) => {
      if (status === 'OK' && results[0]) {
        new (window as any).google.maps.Map(mapRef.current!, {
          center: results[0].geometry.location,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
        })
        new (window as any).google.maps.Marker({
          position: results[0].geometry.location,
          map: mapRef.current,
        })
      }
    })
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!location.trim()) return
    setSelectedLocation(location.trim())
    setScore(0)
    setHasVoted(false)
    setAvgScore(null)
    setTotalRatings(0)
    setReviews([])
    setFeedback(userEmail ? 'Select stars to rate!' : 'Sign in to rate this location')
    await loadMap(location.trim())
    await loadLocationData(location.trim())
  }

  const loadLocationData = async (loc: string) => {
    const { data } = await supabase
      .from('fear_ratings')
      .select('*')
      .eq('location', loc)
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      const scores = data.map((r: any) => r.score)
      const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length
      setAvgScore(Math.round(avg * 10) / 10)
      setTotalRatings(data.length)
      setReviews(data.filter((r: any) => r.review))

      if (userEmail) {
        const userRating = data.find((r: any) => r.user_email === userEmail)
        if (userRating) {
          setScore(userRating.score)
          setHasVoted(true)
          setFeedback(`You already rated this place with ${userRating.score} ⭐. You can update your vote.`)
        }
      }
    }
  }

  const handleRate = async () => {
    if (!userEmail || !selectedLocation || !score) return
    setFeedback('⏳ Saving your rating...')

    const { data: existing } = await supabase
      .from('fear_ratings')
      .select('*')
      .eq('location', selectedLocation)
      .eq('user_email', userEmail)

    if (existing && existing.length > 0) {
      await supabase
        .from('fear_ratings')
        .update({ score, created_at: new Date().toISOString() })
        .eq('id', existing[0].id)
    } else {
      await supabase
        .from('fear_ratings')
        .insert({ location: selectedLocation, score, user_email: userEmail })
    }

    setHasVoted(true)
    setFeedback(`Thank you! Your ${score} score is now registered. Leave a review below!`)
    await loadLocationData(selectedLocation)
  }

  const handleSubmitReview = async () => {
    if (!userEmail || !selectedLocation) return
    setSubmitting(true)
    setFeedback('⏳ Saving your review...')

    let mediaUrl = null
    let videoUrl = null

    if (imageFile) {
      const { data } = await supabase.storage
        .from('reviews')
        .upload(`images/${Date.now()}_${imageFile.name}`, imageFile)
      if (data) {
        const { data: urlData } = supabase.storage.from('reviews').getPublicUrl(data.path)
        mediaUrl = urlData.publicUrl
      }
    }

    if (videoFile) {
      const { data } = await supabase.storage
        .from('reviews')
        .upload(`videos/${Date.now()}_${videoFile.name}`, videoFile)
      if (data) {
        const { data: urlData } = supabase.storage.from('reviews').getPublicUrl(data.path)
        videoUrl = urlData.publicUrl
      }
    }

    const { data: existing } = await supabase
      .from('fear_ratings')
      .select('*')
      .eq('location', selectedLocation)
      .eq('user_email', userEmail)

    if (existing && existing.length > 0) {
      await supabase
        .from('fear_ratings')
        .update({ review: reviewText, media_url: mediaUrl, video_url: videoUrl })
        .eq('id', existing[0].id)
    }

    setReviewText('')
    setImageFile(null)
    setVideoFile(null)
    setFeedback('✅ Your review has been posted. Thank you!')
    setSubmitting(false)
    await loadLocationData(selectedLocation)
  }

  const signIn = () => {
    const email = prompt('Enter your email:')
    if (email) {
      setUserEmail(email)
      setFeedback(selectedLocation ? 'Select stars to rate!' : 'Search a location to rate it!')
    }
  }

  const stars = [1, 2, 3, 4, 5]

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">
      <header className="bg-gray-900 px-4 py-4 flex items-center justify-between">
        <h1 className="text-white text-xl font-medium">
          Fear<span className="text-red-400">Heights</span>
        </h1>
        {userEmail ? (
          <span className="text-green-400 text-sm">{userEmail.split('@')[0].substring(0, 15)} ✓</span>
        ) : (
          <button onClick={signIn} className="text-white text-sm border border-white/30 px-3 py-1.5 rounded-lg">
            Sign in
          </button>
        )}
      </header>

      <form onSubmit={handleSearch} className="p-4 bg-white border-b">
        <div className="flex gap-2">
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Search a location..."
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm">
            Search
          </button>
        </div>
      </form>

      <div ref={mapRef} className="h-48 bg-green-100 flex items-center justify-center text-gray-500 text-sm">
        {!selectedLocation && <span>Map will appear here</span>}
      </div>

      <div className="p-4 bg-white border-b">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Fear rating</p>
        <div className="flex gap-1 mb-1">
          {stars.map(s => (
            <button
              key={s}
              onClick={() => userEmail && selectedLocation && setScore(s)}
              className={`text-3xl transition-transform hover:scale-110 ${s <= score ? 'text-red-400' : 'text-gray-200'}`}
            >
              ★
            </button>
          ))}
        </div>
        {score > 0 && (
          <p className="text-xs text-gray-500 mb-2 italic">{STAR_LABELS[score - 1]}</p>
        )}
        {avgScore !== null && (
          <p className="text-sm text-gray-500 mb-2">
            {stars.map(s => (
              <span key={s} className={s <= Math.round(avgScore) ? 'text-red-400' : 'text-gray-200'}>★</span>
            ))}
            {' '}{avgScore} · {totalRatings} ratings
          </p>
        )}
        <button
          onClick={handleRate}
          disabled={!score || !userEmail || !selectedLocation}
          className="w-full py-3 bg-red-400 text-white rounded-lg font-medium disabled:opacity-40"
        >
          Rate!
        </button>
        <p className="text-sm text-center mt-2 text-gray-500">{feedback}</p>
      </div>

      {hasVoted && userEmail && (
        <div className="p-4 bg-white border-b">
          <p className="text-sm font-medium mb-2">Share your experience</p>
          <textarea
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
            placeholder="What was it like?"
            className="w-full border rounded-lg p-2 text-sm h-20 resize-none"
          />
          <div className="flex gap-2 mt-2">
            <label className="flex-1 border border-dashed rounded-lg p-2 text-xs text-gray-500 text-center cursor-pointer">
              {imageFile ? imageFile.name.substring(0, 15) + '...' : '📷 Add image'}
              <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            </label>
            <label className="flex-1 border border-dashed rounded-lg p-2 text-xs text-gray-500 text-center cursor-pointer">
              {videoFile ? videoFile.name.substring(0, 15) + '...' : '🎥 Add video'}
              <input type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <button
            onClick={handleSubmitReview}
            disabled={submitting || (!reviewText && !imageFile && !videoFile)}
            className="w-full mt-2 py-2 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-40"
          >
            {submitting ? 'Submitting...' : 'Submit review'}
          </button>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="p-4">
          <p className="text-sm font-medium mb-3">Reviews</p>
          {reviews.map((r: any) => (
            <div key={r.id} className="bg-white border rounded-xl p-3 mb-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-medium">{r.user_email.split('@')[0].substring(0, 15)}</span>
                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="text-sm mb-1">
                {stars.map(s => (
                  <span key={s} className={s <= r.score ? 'text-red-400' : 'text-gray-200'}>★</span>
                ))}
                <span className="text-xs text-gray-400 ml-2 italic">{STAR_LABELS[r.score - 1]}</span>
              </div>
              <p className="text-sm text-gray-600">{r.review}</p>
              <div className="flex gap-2 mt-2">
                {r.media_url && (
                  <a href={r.media_url} target="_blank" rel="noopener noreferrer" className="text-xs border rounded px-2 py-1 text-gray-500">
                    📷 View photo
                  </a>
                )}
                {r.video_url && (
                  <a href={r.video_url} target="_blank" rel="noopener noreferrer" className="text-xs border rounded px-2 py-1 text-gray-500">
                    ▶ Watch video
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}