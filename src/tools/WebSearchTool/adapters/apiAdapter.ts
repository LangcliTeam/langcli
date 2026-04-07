/**
 * API-based search adapter — delegates to LangRouter's web_search API.
 */

import axios, { type AxiosResponse } from 'axios'
import { AbortError } from '../../../utils/errors.js'
import { getApiKeyFromApiKeyHelper } from '../../../utils/auth.js'
import type { SearchResult, SearchOptions, WebSearchAdapter } from './types.js'

const FETCH_TIMEOUT_MS = 60_000
const API_BASE_URL = 'https://api.langrouter.ai/v1/web_search'

interface WebSearchHit {
  title: string
  url: string
  snippet?: string
}

interface WebSearchResultItem {
  tool_use_id: string
  content: WebSearchHit[]
}

interface WebSearchResponse {
  id: string
  object: string
  created: number
  model: string
  query: string
  results: (WebSearchResultItem | string)[]
  durationSeconds: number
}

async function getApiToken(): Promise<string | undefined> {
  return (
    process.env.ANTHROPIC_AUTH_TOKEN ||
    (await getApiKeyFromApiKeyHelper(false))
  )
}

export class ApiSearchAdapter implements WebSearchAdapter {
  async search(
    query: string,
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    const { signal, onProgress, allowedDomains, blockedDomains } = options

    if (signal?.aborted) {
      throw new AbortError()
    }

    onProgress?.({ type: 'query_update', query })

    const token = await getApiToken()
    if (!token) {
      throw new Error('No API token available for web search')
    }

    const abortController = new AbortController()
    if (signal) {
      signal.addEventListener('abort', () => abortController.abort(), { once: true })
    }

    let response: AxiosResponse<WebSearchResponse>
    try {
      response = await axios.post<WebSearchResponse>(
        API_BASE_URL,
        {
          query,
          ...(allowedDomains?.length && { allowed_domains: allowedDomains }),
          ...(blockedDomains?.length && { blocked_domains: blockedDomains }),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          timeout: FETCH_TIMEOUT_MS,
        },
      )
    } catch (e) {
      if (axios.isCancel(e) || abortController.signal.aborted) {
        throw new AbortError()
      }
      throw e
    }

    if (abortController.signal.aborted) {
      throw new AbortError()
    }

    const results = this.parseSearchResults(response.data)

    onProgress?.({
      type: 'search_results_received',
      resultCount: results.length,
      query,
    })

    return results
  }

  private parseSearchResults(response: WebSearchResponse): SearchResult[] {
    const searchResults: SearchResult[] = []

    for (const item of response.results) {
      if (typeof item === 'string') continue
      if (!item.content || !Array.isArray(item.content)) continue

      for (const hit of item.content) {
        searchResults.push({
          title: hit.title,
          url: hit.url,
          snippet: hit.snippet,
        })
      }
    }

    return searchResults
  }
}
