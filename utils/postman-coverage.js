import fs from 'fs'

/**
 * @typedef {Object} PostmanRequest
 * @property {string} name - Request name
 * @property {string} folder - Parent folder
 * @property {string} method - HTTP method
 * @property {string} path - Normalized request path
 * @property {Array<{key: string, value: string}>} queryParams - Query parameters
 * @property {Array<string>} statuses - Expected status codes from tests
 */

/**
 * @typedef {Object} CoverageEntry
 * @property {string} method - HTTP method
 * @property {string} path - Request path
 * @property {Object.<string, number>} statuses - Status codes and their counts
 * @property {string[]} queryParams - Query parameter names
 */
export class PostmanParser {
  /**
   * Create a new PostmanParser instance
   * @param {Object} options Configuration options
   * @param {string} [options.basePath=''] Base path to strip from URLs
   * @param {boolean} [options.debug=false] Enable debug logging
   */
  constructor(options = {}) {
    this.basePath = options.basePath || ''
    this.debug = options.debug || false
  }

  /**
   * Convert collection requests to coverage format
   * @param {string} filePath Path to collection JSON file
   * @returns {CoverageEntry[]} Coverage entries in history.json format
   */
  parseCollection(filePath) {
    const collection = this.#loadCollection(filePath)
    const requests = this.#extractRequests(collection)

    const coverageMap = new Map()

    requests.forEach(request => {
      const key = `${request.method} ${request.path}`

      if (!coverageMap.has(key)) {
        const entry = {
          method: request.method,
          path: request.path,
          statuses: {},
          queryParams: []
        }

        // Convert object entries to array and process them
        Object.entries(request.statuses).forEach(([status, count]) => {
          entry.statuses[status] = count
        })

        if (request.queryParams && request.queryParams.length > 0) {
          entry.queryParams = request.queryParams.map(p => p.key)
        }

        coverageMap.set(key, entry)
      } else {
        const entry = coverageMap.get(key)

        // Merge status codes from object
        Object.entries(request.statuses).forEach(([status, count]) => {
          entry.statuses[status] = (entry.statuses[status] || 0) + count
        })

        if (request.queryParams && request.queryParams.length > 0) {
          const params = request.queryParams.map(p => p.key)
          entry.queryParams = [...new Set([...entry.queryParams, ...params])]
        }
      }
    })

    return Array.from(coverageMap.values())
  }

  /**
   * Load Postman collection from file
   * @param {string} filePath Collection file path
   * @returns {Object} Parsed collection JSON
   */
  #loadCollection(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Postman collection not found: ${filePath}`)
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      if (!data.info || !data.item) {
        throw new Error('Invalid Postman collection format')
      }
      return data
    } catch (err) {
      throw new Error(`Failed to parse collection: ${err.message}`)
    }
  }

  /**
   * Extract and normalize requests from collection
   * @param {Object} collection Postman collection object
   * @returns {PostmanRequest[]} Normalized requests
   */
  #extractRequests(collection) {
    const requests = []
    this.#traverseItems(collection.item, requests)
    return requests
  }

  /**
   * Recursively traverse collection items
   * @param {Array} items Collection items
   * @param {PostmanRequest[]} requests Output array
   * @param {string} [folder=''] Current folder name
   */
  #traverseItems(items, requests, folder = '') {
    items.forEach(item => {
      if (item.item) {
        this.#traverseItems(item.item, requests, item.name)
      } else {
        const request = this.#normalizeRequest(item, folder)
        if (request) {
          requests.push(request)
          this.log(`Parsed request: ${request.method} ${request.path}`)
        }
      }
    })
  }

  /**
   * Normalize a Postman request object
   * @param {Object} item Postman request item
   * @param {string} folder Parent folder name
   * @returns {PostmanRequest|null} Normalized request or null if invalid
   */
  #normalizeRequest(item, folder) {
    const req = item.request
    if (!req) return null

    const url = this.#parseUrl(req.url)
    if (!url) return null

    const expectedStatusCodes = this.#parseTestScripts(item.event)

    return {
      name: item.name,
      folder: folder,
      method: (req.method || 'GET').toUpperCase(),
      path: this.#normalizePath(url.path),
      queryParams: url.queryParams,
      statuses: expectedStatusCodes
    }
  }

  /**
   * Parse URL from Postman request
   * @param {string|Object} urlData URL string or object
   * @returns {{path: string, queryParams: Array}} Parsed URL data
   */
  #parseUrl(urlData) {
    if (!urlData) return null

    let rawUrl
    let queryParams = []

    if (typeof urlData === 'string') {
      rawUrl = urlData
    } else if (typeof urlData === 'object') {
      rawUrl = urlData.raw || ''
      if (urlData.query) {
        queryParams = urlData.query.map(q => ({
          key: q.key,
          value: q.value
        }))
      }
    }

    try {
      const url = new URL(rawUrl.startsWith('http') ? rawUrl : `http://example.com${rawUrl}`)
      return {
        path: url.pathname,
        queryParams
      }
    } catch (err) {
      this.log(`Failed to parse URL: ${rawUrl}`)
      return null
    }
  }

  /**
   * Parse test scripts for expected status codes
   * @param {Array} events Request events
   * @returns {Object.<string, number>} Status codes and their counts
   */
  #parseTestScripts(events) {
    const statusCodes = {}

    if (!Array.isArray(events)) return {}

    events.forEach(event => {
      if (event.listen === 'test' && event.script?.exec) {
        const script = event.script.exec.join('\n')
        const patterns = [
          /to\.have\.status\((\d+)\)/g,
          /code\)\.to\.[^(]+\((\d+)\)/g,
          /pm\.response\.code\s*={1,3}\s*(\d+)/g,
          /pm\.response\.status\s*={1,3}\s*(\d+)/g,
          /pm\.expect\(pm\.response\.code\)\.to\.be\.oneOf\(\[\s*([^]]+)\]/g
        ]
        for (let pattern of patterns) {
          const match = pattern.exec(script)
          if (match && match?.length > 0) {
            statusCodes[match[1]] = (statusCodes[match[1]] || 0) + 1
          }
        }
      }
    })

    return statusCodes
  }

  /**
   * Normalize API path by removing base path and ensuring proper format
   * @param {string} path Raw path
   * @returns {string} Normalized path
   */
  #normalizePath(path) {
    let normalized = path

    if (this.basePath && normalized.startsWith(this.basePath)) {
      normalized = normalized.substring(this.basePath.length)
    }

    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized
    }

    normalized = normalized.replace(/\/$/, '')

    return normalized
  }

  /**
   * Debug logging
   * @param {string} message Message to log
   * @private
   */
  log(message) {
    if (this.debug) {
      console.log(`[PostmanParser] ${message}`)
    }
  }
  /**
   * Register requests with ApiCoverage instance
   * @param {object} options options instance
   * @param {string} options.postmanCollection postman collection path
   * @param {object} options.apiCoverage ApiCoverage instance
   * @param {string} options.coverage coverage level
   */
  registerRequests(options = { postmanCollection: '', apiCoverage: {}, coverage: 'basic' }) {
    const { postmanCollection, apiCoverage, coverage } = options
    const requests = this.parseCollection(postmanCollection)
    requests.forEach(entry => {
      Object.entries(entry.statuses).forEach(([status, count]) => {
        apiCoverage.registerRequest(
          entry.method,
          entry.path,
          { status: parseInt(status) },
          entry.queryParams.reduce((obj, param) => ({ ...obj, [param]: 'value' }), {}),
          coverage
        )
      })
    })
  }
}
export const parser = new PostmanParser({
  basePath: '/api/v1',
  debug: false
})
