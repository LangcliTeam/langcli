/**
 * Search adapter factory — selects the appropriate backend by checking
 * whether the API base URL points to Anthropic's official endpoint.
 */
import { ApiSearchAdapter } from './apiAdapter.js'
import type { WebSearchAdapter } from './types.js'

export type { SearchResult, SearchOptions, SearchProgress, WebSearchAdapter } from './types.js'

export function createAdapter(): WebSearchAdapter {
  return new ApiSearchAdapter();
}
