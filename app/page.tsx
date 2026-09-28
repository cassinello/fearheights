'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const STAR_LABELS = [
  'If heights scare you, run away! 😱',
  'Heights alert, proceed with caution! 😨',
  'Some heights, but manageable 🤔',
  "A little elevation, but you're good! 😊",
  'Totally chill, no heights to fear! 😎'
]

const WORLD_MAP_SRC = `https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&center=20,0&zoom=2`

export default function Home() {
  const [location, setLocation] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [feedback, setFeedback] = useState('Search a location to rate it!')
  const [avgScore, setAvgScore] = useState<number | null>(null)
  const [totalRatings, setTotalRatings] = useState(0)
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewText, setReviewText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mapSrc, setMapSrc] = useState<string>(WORLD_MAP_SRC)
  const [globalRatings, setGlobalRatings] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email || null)
        setUserAvatar(session.user.user_metadata?.avatar_url || null)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null)
        setUserAvatar(session.user.user_metadata?.avatar_url || null)
      } else {
        setUserEmail(null)
        setUserAvatar(null)
      }
    })

    supabase
      .from('fear_ratings')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setGlobalRatings(count ?? 0))

    return () => subscription.unsubscribe()
  }, [])

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
    setMapSrc(`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(location.trim())}&zoom=12`)
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
    const { count } = await supabase.from('fear_ratings').select('*', { count: 'exact', head: true })
    setGlobalRatings(count ?? 0)
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

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUserEmail(null)
    setUserAvatar(null)
    setFeedback('Search a location to rate it!')
  }

  const getInitial = (email: string) => email.charAt(0).toUpperCase()
  const stars = [1, 2, 3, 4, 5]

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-[#7b8fc7] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.JPG" alt="Fear Heights logo" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '50%', border: '2px solid rgba(245,237,224,0.5)' }} />
            <div>
              <h1 className="text-[#f5ede0] text-lg font-semibold leading-tight">Fear Heights</h1>
              <p className="text-[#f5ede0] text-xs opacity-70">Stay grounded!</p>
              {globalRatings !== null && (
                <p className="text-[#f5ede0] text-xs opacity-70">{globalRatings.toLocaleString()} ratings</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://x.com/_FearHeights" target="_blank" rel="noopener noreferrer" className="text-[#f5ede0] opacity-70 hover:opacity-100">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {userEmail ? (
              <button onClick={signOut}>
                {userAvatar ? (
                  <img src={userAvatar} alt="avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid rgba(245,237,224,0.5)' }} />
                ) : (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f5ede0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#7b8fc7', fontWeight: 'bold', fontSize: '16px' }}>{getInitial(userEmail)}</span>
                  </div>
                )}
              </button>
            ) : (
              <button onClick={signIn} className="text-[#f5ede0] text-xs border border-[#f5ede0]/40 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in
              </button>
            )}
          </div>
        </div>
        <p className="text-[#f5ede0] text-xs opacity-80 leading-relaxed mt-2">
          Rate places by how much they scare you. 😱 Search any location, leave your vertigo rating & reviews. Do you dare? 👉
        </p>
      </header>

      {/* Search */}
      <form onSubmit={handleSearch} className="p-4 bg-white border-b">
        <div className="flex gap-2">
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Search a location..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400"
          />
          <button type="submit" className="bg-[#7b8fc7] text-white px-4 py-2 rounded-lg text-sm">Search</button>
        </div>
      </form>

      {/* Map */}
      <div className="h-48">
        <iframe src={mapSrc} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" />
      </div>

      {/* Rating */}
      <div className="p-4 bg-white border-b">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Fear rating</p>

        <div className="flex items-center gap-3 mb-1">
          <div className="flex gap-1">
            {stars.map(s => (
              <button key={s} onClick={() => userEmail && selectedLocation && setScore(s)} className={`text-3xl transition-transform hover:scale-110 ${s <= score ? 'text-[#7b8fc7]' : 'text-gray-200'}`}>★</button>
            ))}
          </div>
          <button
            onClick={handleRate}
            disabled={!score || !userEmail || !selectedLocation}
            className="flex-1 py-2 bg-[#7b8fc7] text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            Rate!
          </button>
        </div>

        {score > 0 && <p className="text-xs text-gray-500 mb-2 italic">{STAR_LABELS[score - 1]}</p>}
        {avgScore !== null && (
          <p className="text-sm text-gray-500 mb-2">
            {stars.map(s => <span key={s} className={s <= Math.round(avgScore) ? 'text-[#7b8fc7]' : 'text-gray-200'}>★</span>)}
            {' '}{avgScore} · {totalRatings} ratings
          </p>
        )}
        <p className="text-sm text-center mb-3 text-gray-500">{feedback}</p>

        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
          {STAR_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="text-[#7b8fc7] text-sm w-20">{'★'.repeat(i + 1)}{'☆'.repeat(4 - i)}</span>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review form */}
      {hasVoted && userEmail && (
        <div className="p-4 bg-white border-b">
          <p className="text-sm font-medium mb-2">Share your experience</p>
          <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="What was it like?" className="w-full border border-gray-300 rounded-lg p-2 text-sm h-20 resize-none text-gray-900" />
          <div className="flex gap-2 mt-2">
            <label className="flex-1 border border-dashed border-gray-300 rounded-lg p-2 text-xs text-gray-500 text-center cursor-pointer">
              {imageFile ? imageFile.name.substring(0, 15) + '...' : '📷 Add image'}
              <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            </label>
            <label className="flex-1 border border-dashed border-gray-300 rounded-lg p-2 text-xs text-gray-500 text-center cursor-pointer">
              {videoFile ? videoFile.name.substring(0, 15) + '...' : '🎥 Add video'}
              <input type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <button onClick={handleSubmitReview} disabled={submitting || (!reviewText && !imageFile &&