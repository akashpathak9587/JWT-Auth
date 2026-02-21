import React, { useState } from 'react'
import auth from './auth'

export default function Register({ onRegistered }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Registration failed')
      // auto-login
      const loginRes = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const loginBody = await loginRes.json()
      if (!loginRes.ok) throw new Error(loginBody.error || 'Auto-login failed')
      auth.saveTokens({ accessToken: loginBody.accessToken, refreshToken: loginBody.refreshToken })
      onRegistered && onRegistered(loginBody.accessToken)
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>Register</h2>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 10 }}>
          <label>Username</label>
          <input value={username} onChange={(e)=>setUsername(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Password</label>
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
      </form>
    </div>
  )
}
