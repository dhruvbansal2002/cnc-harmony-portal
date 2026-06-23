function hasAuthCallbackParams(search: string, hash: string) {
  const queryParams = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

  return (
    queryParams.has('code') ||
    queryParams.has('error') ||
    queryParams.has('access_token') ||
    queryParams.has('refresh_token') ||
    hashParams.has('code') ||
    hashParams.has('error') ||
    hashParams.has('access_token') ||
    hashParams.has('refresh_token')
  )
}

function buildAuthCallbackPath(search: string, hash: string) {
  return `/auth/callback${search}${hash}`
}

export { buildAuthCallbackPath, hasAuthCallbackParams }
