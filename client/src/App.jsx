import React, { useState, useEffect } from 'react'
import Login from './Login'
import Register from './Register'
import auth, { fetchWithAuth, refreshAccessTokenPublic } from './auth'

export default function App() {
  const [accessToken, setAccessToken] = useState(auth.getAccessToken())
  const [profile, setProfile] = useState(null)
  const [showRegister, setShowRegister] = useState(false)

  useEffect(() => {
    setAccessToken(auth.getAccessToken())
  }, [])

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken)
      // fetch profile
      fetchWithAuth('/api/profile').then(r => r.json()).then(b => setProfile(b)).catch(() => setProfile(null))
    } else {
      auth.removeTokens()
      setProfile(null)
    }
  }, [accessToken])

  if (!accessToken) {
    return showRegister ? <Register onRegistered={setAccessToken} /> : <>
      <Login onLogin={setAccessToken} />
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button onClick={() => setShowRegister(true)}>Create account</button>
      </div>
    </>
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Protected Area</h2>
      {profile ? <p>Welcome, {profile.username}</p> : <p>Loading profile...</p>}
      <p>Access token (expires in):</p>
      <pre style={{ maxWidth: 600, whiteSpace: 'break-spaces' }}>{accessToken}</pre>
      <div style={{ marginTop: 8 }}>
        <button onClick={() => { auth.removeTokens(); setAccessToken(null); }}>Logout</button>
        <button style={{ marginLeft: 8 }} onClick={async () => {
          try {
            await refreshAccessTokenPublic();
            setAccessToken(auth.getAccessToken());
          } catch (e) {
            alert('Refresh failed: ' + e.message);
          }
        }}>Refresh token</button>
      </div>
    </div>
  )
}
