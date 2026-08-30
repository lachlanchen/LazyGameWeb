const GAME_ID = 'game_[0-9a-f]{32}'
const GAME_ROOT = new RegExp(`^/api/games/(${GAME_ID})$`)
const GAME_CHILD = new RegExp(`^/api/games/(${GAME_ID})/(coach-history|preview|analysis|moves|agent-turn|rewind|coach)$`)

export class RouteError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function queryObject(searchParams, { limitMax, cursorMax } = {}) {
  const entries = [...searchParams.entries()]
  if (!limitMax && entries.length) throw new RouteError(400, 'query_not_allowed', 'This route does not accept a query string')
  const seen = new Set()
  const result = {}
  for (const [key, value] of entries) {
    if (seen.has(key)) throw new RouteError(400, 'duplicate_query', 'Duplicate query fields are not accepted')
    seen.add(key)
    if (key === 'limit') {
      if (!/^[1-9][0-9]{0,2}$/.test(value)) throw new RouteError(400, 'invalid_query', 'limit must be a canonical positive integer')
      const limit = Number(value)
      if (limit > limitMax) throw new RouteError(400, 'invalid_query', 'limit exceeds the route bound')
      result.limit = limit
    } else if (key === 'cursor') {
      if (typeof value !== 'string' || value.length > cursorMax || !/^[A-Za-z0-9_-]+$/.test(value)) {
        throw new RouteError(400, 'invalid_query', 'cursor is invalid')
      }
      result.cursor = value
    } else throw new RouteError(400, 'unknown_query', 'Unknown query field')
  }
  return Object.keys(result).length ? result : undefined
}

function noQuery(searchParams) {
  return queryObject(searchParams)
}

export function resolveBrowserApi(method, url) {
  const normalizedMethod = method.toUpperCase()
  const path = url.pathname
  if (path === '/api/engine-analysis') {
    if (normalizedMethod !== 'POST') throw new RouteError(405, 'method_not_allowed', 'Chess analysis requires POST')
    noQuery(url.searchParams)
    return { product: 'chess', method: 'POST', path }
  }
  if (path === '/api/douzero/health') {
    if (normalizedMethod !== 'GET') throw new RouteError(405, 'method_not_allowed', 'DouZero health requires GET')
    noQuery(url.searchParams)
    return { product: 'poker', method: 'GET', path }
  }
  if (path === '/api/douzero/analyze') {
    if (normalizedMethod !== 'POST') throw new RouteError(405, 'method_not_allowed', 'DouZero analysis requires POST')
    noQuery(url.searchParams)
    return { product: 'poker', method: 'POST', path }
  }
  if (path === '/api/status' || path === '/api/curriculum') {
    if (normalizedMethod !== 'GET') throw new RouteError(405, 'method_not_allowed', 'This Weiqi route requires GET')
    noQuery(url.searchParams)
    return { product: 'weiqi', method: 'GET', path }
  }
  if (path === '/api/games') {
    if (normalizedMethod !== 'GET' && normalizedMethod !== 'POST') throw new RouteError(405, 'method_not_allowed', 'This Weiqi route accepts GET or POST')
    const query = normalizedMethod === 'GET'
      ? queryObject(url.searchParams, { limitMax: 100, cursorMax: 160 })
      : noQuery(url.searchParams)
    return { product: 'weiqi', method: normalizedMethod, path, ...(query ? { query } : {}) }
  }
  const rootMatch = GAME_ROOT.exec(path)
  if (rootMatch) {
    if (normalizedMethod !== 'GET' && normalizedMethod !== 'DELETE') throw new RouteError(405, 'method_not_allowed', 'This Weiqi game route accepts GET or DELETE')
    noQuery(url.searchParams)
    return { product: 'weiqi', method: normalizedMethod, path }
  }
  const childMatch = GAME_CHILD.exec(path)
  if (childMatch) {
    const action = childMatch[2]
    if (action === 'coach-history') {
      if (normalizedMethod !== 'GET') throw new RouteError(405, 'method_not_allowed', 'Coach history requires GET')
      const query = queryObject(url.searchParams, { limitMax: 80, cursorMax: 512 })
      return { product: 'weiqi', method: 'GET', path, ...(query ? { query } : {}) }
    }
    if (normalizedMethod !== 'POST') throw new RouteError(405, 'method_not_allowed', 'This Weiqi action requires POST')
    noQuery(url.searchParams)
    return { product: 'weiqi', method: 'POST', path }
  }
  if (path.startsWith('/api/')) throw new RouteError(404, 'api_route_not_found', 'API route not found')
  return null
}

export function dispatchEnvelope(route, body) {
  return {
    schema: 'lazyingart.game-dispatch.v1',
    product: route.product,
    method: route.method,
    path: route.path,
    ...(route.query ? { query: route.query } : {}),
    ...(route.method === 'GET' ? {} : { body }),
  }
}
