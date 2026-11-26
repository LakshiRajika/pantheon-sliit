// Thin fetch wrapper: base URL, bearer token, JSON handling, and a normalized error type.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'pantheon.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const token = tokenStore.get()
  const isForm = body instanceof FormData
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the Pantheon server. Is the backend running?')
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)

  if (!res.ok) {
    // Backend errors are {code, message}; FastAPI's own validation errors are {detail}.
    const message =
      data?.message ??
      (typeof data?.detail === 'string' ? data.detail : null) ??
      `Request failed (${res.status})`
    if (res.status === 401 && token) window.dispatchEvent(new Event('pantheon:unauthorized'))
    throw new ApiError(res.status, data?.code ?? 'HTTP_ERROR', message)
  }
  return data
}
