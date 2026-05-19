'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'cst_recent_users'

function getRecentUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecentUser(email) {
  const existing = getRecentUsers().filter(e => e !== email)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([email, ...existing].slice(0, 8)))
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recentUsers, setRecentUsers] = useState([])
  const passwordRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    setRecentUsers(getRecentUsers())
  }, [])

  function selectUser(userEmail) {
    setEmail(userEmail)
    setPassword('')
    setError('')
    setTimeout(() => passwordRef.current?.focus(), 50)
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      saveRecentUser(email)
      router.push('/')
      router.refresh()
    }
  }

  function removeRecentUser(userEmail) {
    const updated = getRecentUsers().filter(e => e !== userEmail)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setRecentUsers(updated)
  }

  const displayName = (userEmail) => userEmail.split('@')[0]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-800">Cold Storage Tracker</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Sign in to your account</p>

        {recentUsers.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Who are you?</p>
            <div className="space-y-2">
              {recentUsers.map(userEmail => (
                <div key={userEmail} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectUser(userEmail)}
                    className={`flex-1 text-left px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      email === userEmail
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                    }`}
                  >
                    {displayName(userEmail)}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecentUser(userEmail)}
                    className="text-gray-300 hover:text-gray-500 text-lg leading-none px-1"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 text-center">or sign in with a different account below</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password / PIN</label>
            <input
              ref={passwordRef}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
