// Lightweight auth helpers: token storage and fetch wrapper with refresh
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch (e) {
    return null;
  }
}

export function saveTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

export function getAccessToken() { return localStorage.getItem('accessToken'); }
export function getRefreshToken() { return localStorage.getItem('refreshToken'); }
export function removeTokens() { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); }

export function isTokenExpired(token, offsetSeconds = 10) {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return true;
  const expMs = payload.exp * 1000;
  return Date.now() + offsetSeconds * 1000 >= expMs;
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch('/api/refresh', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken })
  });
  if (!res.ok) throw new Error('Refresh failed');
  const body = await res.json();
  if (body.accessToken) {
    localStorage.setItem('accessToken', body.accessToken);
    return body.accessToken;
  }
  throw new Error('No accessToken in refresh response');
}

export async function refreshAccessTokenPublic() { return refreshAccessToken(); }

export async function fetchWithAuth(input, init = {}) {
  let token = getAccessToken();
  if (!token) throw new Error('Missing access token');
  if (isTokenExpired(token)) {
    token = await refreshAccessToken();
  }
  const headers = Object.assign({}, init.headers || {}, { Authorization: `Bearer ${token}` });
  const res = await fetch(input, Object.assign({}, init, { headers }));
  if (res.status === 401) {
    // try once to refresh
    token = await refreshAccessToken();
    const headers2 = Object.assign({}, init.headers || {}, { Authorization: `Bearer ${token}` });
    return fetch(input, Object.assign({}, init, { headers: headers2 }));
  }
  return res;
}

export default {
  saveTokens, getAccessToken, getRefreshToken, removeTokens, isTokenExpired, fetchWithAuth
}
