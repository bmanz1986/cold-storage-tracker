'use client'
import { useState, useEffect } from 'react'
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

function displayName(email) {
  return email.split('@')[0]
}

export default function LoginPage() {
  const [recentUsers, setRecentUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null) // email string
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // manual login fallback
  const [showManual, setShowManual] = useState(false)
  const [manualEmail, setManualEmail] = useState('')
  const [manualPassword, setManualPassword] = useState('')

  const router = useRouter()

  useEffect(() => {
    setRecentUsers(getRecentUsers())
  }, [])

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      doLogin(selectedUser, pin)
    }
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectUser(email) {
    setSelectedUser(email)
    setPin('')
    setError('')
  }

  function pressKey(key) {
    if (loading) return
    setError('')
    if (key === '⌫') {
      setPin(prev => prev.slice(0, -1))
    } else if (pin.length < 4) {
      setPin(prev => prev + key)
    }
  }

  async function doLogin(email, password) {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Wrong PIN — try again')
      setPin('')
      setLoading(false)
    } else {
      saveRecentUser(email)
      router.push('/')
      router.refresh()
    }
  }

  async function handleManualLogin(e) {
    e.preventDefault()
    doLogin(manualEmail, manualPassword)
  }

  function removeRecentUser(email) {
    const updated = getRecentUsers().filter(e => e !== email)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setRecentUsers(updated)
    if (selectedUser === email) setSelectedUser(null)
  }

  const PAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '⌫']

  // --- PIN pad screen ---
  if (selectedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-xs text-center">
          <p className="text-sm text-gray-500 mb-1">Signing in as</p>
          <p className="text-xl font-bold text-gray-800 mb-6">{displayName(selectedUser)}</p>

          {/* PIN dots */}
          <div className="flex justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border-2 transition-colors ${
                  i < pin.length
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300'
                }`}
              />
            ))}
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {PAD_KEYS.map((key, i) => {
              if (key === null) return <div key={i} />
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pressKey(String(key))}
                  disabled={loading}
                  className={`
                    h-16 rounded-xl text-xl font-semibold transition-colors disabled:opacity-50
                    ${key === '⌫'
                      ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 active:bg-gray-300'
                      : 'bg-gray-50 text-gray-800 hover:bg-blue-50 active:bg-blue-100 border border-gray-200'}
                  `}
                >
                  {loading && pin.length === 4 ? '…' : key}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => { setSelectedUser(null); setPin(''); setError('') }}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // --- User selection screen ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-800">Cold Storage Tracker</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Who are you?</p>

        {recentUsers.length > 0 && (
          <div className="space-y-2 mb-6">
            {recentUsers.map(email => (
              <div key={email} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectUser(email)}
                  className="flex-1 text-left px-4 py-3 rounded-lg border bg-gray-50 text-gray-800 border-gray-200 hover:bg-blue-50 hover:border-blue-300 font-medium text-sm transition-colors"
                >
                  {displayName(email)}
                </button>
                <button
                  type="button"
                  onClick={() => removeRecentUser(email)}
                  className="text-gray-300 hover:text-gray-500 text-lg px-1"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Manual sign-in toggle */}
        <button
          type="button"
          onClick={() => setShowManual(v => !v)}
          className="w-full text-sm text-gray-400 hover:text-gray-600 text-center"
        >
          {showManual ? '▲ Hide' : recentUsers.length > 0 ? '+ Sign in with a different account' : '+ Sign in'}
        </button>

        {showManual && (
          <form onSubmit={handleManualLogin} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={manualEmail}
                onChange={e => setManualEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password / PIN</label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={manualPassword}
                onChange={e => setManualPassword(e.target.value)}
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
        )}
      </div>
    </div>
  )
}
