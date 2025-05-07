//new
import SwaggerParser from '@apidevtools/swagger-parser'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parser } from './postman-coverage.js'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * @typedef {Object} OpenAPISpec
 * @property {Object} [paths] - API paths
 * @property {string} [basePath] - Base path for OpenAPI 2.0
 * @property {Array<{url: string}>} [servers] - Servers for OpenAPI 3.0+
 * @property {Object} info - API info
 * @property {Object} [components] - OpenAPI components
 * @property {string} [jsonSchemaDialect] - JSON Schema dialect
 * @property {Object} [webhooks] - Webhooks
 */

/**
 * @typedef {Object} ServiceConfig
 * @property {string} key - Service key
 * @property {string} name - Service name
 * @property {string[]} tags - Service tags
 * @property {string} repository - Service repository URL
 * @property {string} swaggerUrl - Swagger/OpenAPI spec URL
 * @property {string} swaggerFile - Local Swagger/OpenAPI spec file path
 */

/**
 * Class for tracking API coverage and generating coverage reports
 * @class
 */
export class ApiCoverage {
  /**
   * Create a new ApiCoverage instance
   * @param {Object} config - Configuration object
   * @param {ServiceConfig[]} config.services - Array of service configurations
   */
  constructor(config) {
    this.apiSpec = null
    this.coverageMap = new Map()
    this.endpoints = new Map()
    this.originalRequest = null
    this.basePath = ''
    this.debug = false
    this.clientType = null
    this.clientInstance = null
    this.queryParamsCoverage = new Map()
    this.coverageType = 'basic'
    this.config = config
    this.TEMPLATE_PATH = path.resolve(__dirname, './templates/index.html')
    this.JSON_REPORT_PATH = config['json-report-path']
    this.JSON_REPORT_HISTORY_PATH = config['json-report-history-path']
    this.REPORT_PATH = config['html-report-path']
    this.STATS_PATH = config['stats-path']
  }

  /**
   * Enable or disable debug logging
   * @param {boolean} enabled - Whether to enable debug logging
   * @example
   * apiCoverage.setDebug(true); // Enable debug logging
   * apiCoverage.setDebug(false); // Disable debug logging
   */
  setDebug(enabled) {
    this.debug = enabled
  }

  /**
   * Debug log function that only logs when debug is enabled
   * @param {string} message - Message to log
   * @private
   */
  log(message) {
    if (this.debug) {
      console.log(`[ApiCoverage] ${message}`)
    }
  }

  /**
   * Load OpenAPI specification from a file or URL
   * @param {string} source - Path to the Swagger/OpenAPI spec file or URL
   * @returns {Promise<OpenAPISpec>} - Returns parsed schema if the spec is successfully loaded
   * @throws {Error} - Throws an error if the spec cannot be loaded or parsed
   * @example
   * // Load from URL
   * await apiCoverage.loadSpec('https://api.example.com/swagger.json');
   * // Load from local file
   * await apiCoverage.loadSpec('./swagger.json');
   */
  async loadSpec(source) {
    if (this.apiSpec) return this.apiSpec
    try {
      const urlRegex = /^https?:\/\//
      if (urlRegex.test(source)) {
        this.apiSpec = await SwaggerParser.validate(source)
      } else {
        const resolvedPath = path.resolve(source)
        this.apiSpec = await SwaggerParser.validate(resolvedPath)
      }
      this.#parseEndpoints()

      // Handle both OpenAPI 2.0 (Swagger) and OpenAPI 3.0+ specs
      // @ts-ignore - We know these properties exist in OpenAPI specs
      this.basePath =
        this.apiSpec.basePath ||
        // @ts-ignore - We know these properties exist in OpenAPI specs
        (this.apiSpec.servers && this.apiSpec.servers[0]?.url
          ? // @ts-ignore - We know these properties exist in OpenAPI specs
            this.apiSpec.servers[0].url.replace(/^https?:\/\/[^/]+/, '')
          : '')

      this.log(`Loaded API spec with basePath: ${this.basePath}`)
      this.log(`Parsed ${this.endpoints.size} endpoints`)

      return this.apiSpec
    } catch (error) {
      throw new Error(`Failed to load API spec: ${error.message}`)
    }
  }

  /**
   * Parse the API specification to extract all endpoints
   * @description Extracts all endpoints from the OpenAPI spec and stores them in the endpoints Map
   */
  #parseEndpoints() {
    if (this.endpoints.size > 0) return
    const { paths } = this.apiSpec
    for (const path in paths) {
      const pathItem = paths[path]

      for (const method in pathItem) {
        if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
          const endpoint = {
            path,
            method: method.toUpperCase(),
            operation: pathItem[method],
            covered: false,
            // Create a regex pattern for this path
            pathRegex: this.#createPathRegex(path)
          }

          const key = `${endpoint.path} ${endpoint.method}`
          this.endpoints.set(key, endpoint)
        }
      }
    }

    this.log(`Parsed ${this.endpoints.size} endpoints from API spec`)
    // Log all endpoints in debug mode
    for (const [key, endpoint] of this.endpoints.entries()) {
      this.log(`Registered endpoint: ${key} (regex: ${endpoint.pathRegex})`)
    }
  }

  /**
   * Create a regex pattern for matching an OpenAPI path
   * @param {string} pathTemplate - OpenAPI path template (e.g., /pet/{petId})
   * @returns {RegExp} - Regular expression for matching this path
   * @example
   * // Returns regex for matching /pet/123
   * _createPathRegex('/pet/{petId}')
   */
  #createPathRegex(pathTemplate) {
    let pattern = pathTemplate.replace(/[.*+?^${}()[\]\\]/g, match => (match === '{' || match === '}' ? match : '\\' + match))

    // Replace {paramName} with a regex that matches single path segment(s)
    pattern = pattern.replace(/\{[^/{}]+\}/g, '([^/]+)') // '([^/]+(?:/[^/]+)*)' - multimple path segments

    const segments = pattern.split('/').filter(Boolean)

    pattern = segments
      .map((segment, index) => {
        if (segment.includes('(') && segment.includes(')')) {
          return segment + '(?=/|$)'
        }
        return segment
      })
      .join('/')
    pattern = `^/${pattern}/?$`
    return new RegExp(pattern)
  }

  /**
   * Start tracking API requests by patching the provided HTTP client
   * @param {Object} client - HTTP client instance (Playwright APIRequestContext, Axios instance, etc.)
   * @param {Object} [options] - Options object
   * @param {string} [options.clientType='playwright'] - Type of client ('playwright', 'axios', 'fetch')
   * @param {string} [options.coverage='basic'] - Coverage type ('basic', 'detailed')
   * @returns {boolean} - Whether tracking was successfully started
   * @throws {Error} - Throws an error if client type is unsupported
   * @example
   * // Start tracking with Playwright
   * await apiCoverage.startTracking(playwright.request, { clientType: 'playwright' });
   * // Start tracking with Axios
   * await apiCoverage.startTracking(axios, { clientType: 'axios' });
   */
  startTracking(client, options = { clientType: 'playwright', coverage: 'basic' }) {
    // Only patch if not already patched
    if (this.originalRequest) {
      this.log('Already tracking requests, ignoring startTracking call')
      return
    }

    this.clientType = options.clientType
    this.clientInstance = client
    this.coverageType = options.coverage

    this.log(`Starting tracking with client type: ${options.clientType}`)

    switch (options.clientType.toLowerCase()) {
      case 'playwright':
        this.#patchPlaywright(client)
        break
      case 'axios':
        this.#patchAxios(client)
        break
      case 'fetch':
        this.#patchFetch(client)
        break
      default:
        throw new Error(`Unsupported client type: ${options.clientType}`)
    }

    return true
  }

  /**
   * Patch Playwright's APIRequestContext
   * @param {import('@playwright/test').APIRequestContext} request - Playwright APIRequestContext
   * @description Patches Playwright's request methods to track API coverage
   */
  #patchPlaywright(request) {
    this.playwright = true
    // Store original methods for later restoration
    this.originalRequest = {}
    const methodsToTrack = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']

    methodsToTrack.forEach(method => {
      if (typeof request[method] === 'function') {
        this.originalRequest[method] = request[method]

        // Override the method to track usage
        request[method] = async (url, options) => {
          // Call the original method
          const response = await this.originalRequest[method].call(request, url, options)

          // Track this endpoint
          try {
            // Handle both full URLs and relative paths
            let pathname
            let queryParams = {}

            try {
              const parsedUrl = new URL(url)
              pathname = parsedUrl.pathname

              // Extract query parameters
              for (const [key, value] of parsedUrl.searchParams.entries()) {
                queryParams[key] = value
              }
            } catch {
              // If URL parsing fails, assume it's a path
              const [path, query] = url.split('?')
              pathname = path

              // Extract query parameters if present
              if (query) {
                const params = new URLSearchParams(query)
                for (const [key, value] of params.entries()) {
                  queryParams[key] = value
                }
              }
            }

            this.log(`Tracking request: ${method.toUpperCase()} ${pathname}`)
            this.#markEndpointCovered(method.toUpperCase(), pathname, response.status(), queryParams)
          } catch (error) {
            console.warn(`Failed to track request: ${method} ${url}`, error)
          }

          return response
        }
      }
    })
  }

  /**
   * Patch Axios instance
   * @param {import('axios').AxiosInstance} axiosInstance - Axios instance
   * @description Patches Axios instance methods to track API coverage
   */
  #patchAxios(axiosInstance) {
    this.axios = true
    this.log('Patching Axios instance')

    // Store original methods for later restoration
    this.originalRequest = {
      request: axiosInstance.request
    }

    // Override the request method to track usage
    axiosInstance.request = async config => {
      this.log(`Axios request called with config: ${JSON.stringify(config)}`)

      // Call the original method
      const response = await this.originalRequest.request.call(axiosInstance, config)

      // Track this endpoint
      try {
        const method = (config.method || 'get').toUpperCase()
        const url = config.url || ''

        // Handle both full URLs and relative paths
        let pathname
        let queryParams = {}

        try {
          const parsedUrl = new URL(url)
          pathname = parsedUrl.pathname

          // Extract query parameters
          for (const [key, value] of parsedUrl.searchParams.entries()) {
            queryParams[key] = value
          }
        } catch {
          // If URL parsing fails, assume it's a path
          const [path, query] = url.split('?')
          pathname = path

          // Extract query parameters if present
          if (query) {
            const params = new URLSearchParams(query)
            for (const [key, value] of params.entries()) {
              queryParams[key] = value
            }
          }
        }

        this.log(`Tracking Axios request: ${method} ${pathname}`)
        const result = this.#markEndpointCovered(method, pathname, response.status, queryParams)
        this.log(`Endpoint coverage result: ${result}`)
      } catch (error) {
        console.warn(`Failed to track Axios request: ${config.method} ${config.url}`, error)
      }

      return response
    }

    // Also patch the convenience methods
    const methodsToTrack = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']
    methodsToTrack.forEach(method => {
      if (typeof axiosInstance[method] === 'function') {
        this.originalRequest[method] = axiosInstance[method]

        // Override the method to track usage
        axiosInstance[method] = async (url, data, config) => {
          this.log(`Axios ${method} called with url: ${url}`)

          // Call the original method
          const response = await this.originalRequest[method].call(axiosInstance, url, data, config)

          // Track this endpoint
          try {
            // Handle both full URLs and relative paths
            let pathname
            let queryParams = {}

            try {
              const parsedUrl = new URL(url)
              pathname = parsedUrl.pathname

              // Extract query parameters
              for (const [key, value] of parsedUrl.searchParams.entries()) {
                queryParams[key] = value
              }
            } catch {
              // If URL parsing fails, assume it's a path
              const [path, query] = url.split('?')
              pathname = path

              // Extract query parameters if present
              if (query) {
                const params = new URLSearchParams(query)
                for (const [key, value] of params.entries()) {
                  queryParams[key] = value
                }
              }
            }

            this.log(`Tracking Axios ${method}: ${method.toUpperCase()} ${pathname}`)
            const result = this.#markEndpointCovered(method.toUpperCase(), pathname, response.status, queryParams)
            this.log(`Endpoint coverage result: ${result}`)
          } catch (error) {
            console.warn(`Failed to track Axios ${method}: ${method} ${url}`, error)
          }

          return response
        }
      }
    })

    this.log('Axios instance patched successfully')
  }

  /**
   * Patch global fetch function
   * @param {Function} fetchFn - Global fetch function
   * @description Patches global fetch function to track API coverage
   */
  #patchFetch(fetchFn) {
    this.fetch = true
    // Store original fetch for later restoration
    this.originalRequest = {
      fetch: fetchFn
    }

    // Override the global fetch function
    // @ts-ignore - We're intentionally replacing the global fetch with a compatible function
    global.fetch = async (input, init) => {
      // Call the original fetch
      const response = await this.originalRequest.fetch(input, init)

      // Track this endpoint
      try {
        const method = (init?.method || 'GET').toUpperCase()
        const url = typeof input === 'string' ? input : input.url

        // Handle both full URLs and relative paths
        let pathname
        let queryParams = {}

        try {
          const parsedUrl = new URL(url)
          pathname = parsedUrl.pathname

          // Extract query parameters
          for (const [key, value] of parsedUrl.searchParams.entries()) {
            queryParams[key] = value
          }
        } catch {
          // If URL parsing fails, assume it's a path
          const [path, query] = url.split('?')
          pathname = path

          // Extract query parameters if present
          if (query) {
            const params = new URLSearchParams(query)
            for (const [key, value] of params.entries()) {
              queryParams[key] = value
            }
          }
        }

        this.log(`Tracking request: ${method} ${pathname}`)
        this.#markEndpointCovered(method, pathname, response.status, queryParams)
      } catch (error) {
        console.warn(`Failed to track request: ${init?.method || 'GET'} ${input}`, error)
      }

      return response
    }
  }

  /**
   * Mark an endpoint as covered
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Request path (/api/users, etc.)
   * @param {number} statusCode - HTTP status code
   * @param {Object} [queryParams={}] - Query parameters used in the request
   * @returns {boolean} - Whether the endpoint was successfully marked as covered
   */
  #markEndpointCovered(method, path, statusCode, queryParams = {}) {
    this.log(`Marking endpoint as covered: ${method} ${path} (status: ${statusCode})`)

    // Create a copy of the path to avoid modifying the parameter
    let normalizedPath = path.replace(/\/$/, '')

    if (this.basePath && normalizedPath.startsWith(this.basePath)) {
      normalizedPath = normalizedPath.substring(this.basePath.length)
    }

    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath
    }

    const exactKey = `${normalizedPath} ${method}`
    this.log(`Looking for exact match: ${exactKey}`)

    let matchedEndpointKey = null

    if (this.endpoints.has(exactKey)) {
      matchedEndpointKey = exactKey
      this.log(`Found exact match: ${exactKey}`)
    } else {
      this.log(`No exact match, trying regex matching for ${normalizedPath} ${method}`)
      for (const [key, endpoint] of this.endpoints.entries()) {
        // First check if the method matches exactly
        if (endpoint.method !== method) {
          this.log(`Method mismatch: ${endpoint.method} !== ${method}`)
          continue
        }

        // Then check if the path matches
        if (endpoint.pathRegex.test(normalizedPath)) {
          matchedEndpointKey = key
          this.log(`Found regex match: ${key}`)
          break
        }
      }
    }

    if (!matchedEndpointKey) {
      this.log(`No match found for: ${method} ${normalizedPath}`)
      return false
    }

    const endpoint = this.endpoints.get(matchedEndpointKey)
    endpoint.covered = true

    if (!this.coverageMap.has(matchedEndpointKey)) {
      this.coverageMap.set(matchedEndpointKey, {
        path: endpoint.path,
        method: endpoint.method,
        statuses: new Map()
      })
      this.log(`Added new endpoint to coverage map: ${matchedEndpointKey}`)
    }

    const record = this.coverageMap.get(matchedEndpointKey)
    record.statuses.set(statusCode, (record.statuses.get(statusCode) || 0) + 1)
    this.log(`Updated coverage for ${matchedEndpointKey} with status ${statusCode}`)
    this.log(`Current coverage map size: ${this.coverageMap.size}`)

    // Track query parameters if any were used
    if (Object.keys(queryParams).length > 0) {
      if (!this.queryParamsCoverage.has(matchedEndpointKey)) {
        this.queryParamsCoverage.set(matchedEndpointKey, new Set())
      }

      const paramSet = this.queryParamsCoverage.get(matchedEndpointKey)
      for (const paramName of Object.keys(queryParams)) {
        paramSet.add(paramName)
        this.log(`Marked query parameter as covered: ${matchedEndpointKey} - ${paramName}`)
      }
    }

    return true
  }

  /**
   * Manually register a request as covered
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Request path (/api/users, etc.)
   * @param {Object} response - Response object with status() or status property
   * @param {Object} [queryParams={}] - Query parameters used in the request
   * @param {string} [coverage='basic'] - Coverage type ('basic', 'detailed')
   * @returns {boolean} - Whether the registration was successful
   * @example
   * apiCoverage.registerRequest('GET', '/api/users', { status: 200 }, { page: 1 });
   */
  registerRequest(method, path, response, queryParams = {}, coverage = 'basic') {
    this.coverageType = coverage
    this.log(`Manually registering: ${method} ${path}`)
    const statusCode = typeof response.status === 'function' ? response.status() : response.status
    return this.#markEndpointCovered(method.toUpperCase(), path, statusCode, queryParams)
  }
  /**
   * Register requests from a Postman collection
   * @param {Object} params - Configuration options
   * @param {string} params.collectionPath - Path to Postman collection file
   * @param {string} params.coverage - Coverage type ('basic', 'detailed')
   * @returns {void}
   * @example
   * apiCoverage.registerPostmanRequests('./collection.json', 'detailed');
   */
  registerPostmanRequests(params = { collectionPath: '', coverage: 'basic' }) {
    const { collectionPath, coverage } = params
    this.log(`Registering requests from Postman collection: ${collectionPath}`)
    const options = {
      postmanCollection: collectionPath,
      apiCoverage: this,
      coverage: coverage
    }

    try {
      parser.registerRequests(options)
      this.log('Successfully registered Postman collection requests')
    } catch (error) {
      throw new Error(`Failed to register Postman requests: ${error.message}`)
    }
  }

  /**
   * Stop tracking API requests and restore original methods
   * @param {Object} [client] - HTTP client instance (optional, will use stored instance if not provided)
   * @returns {boolean} - Whether tracking was successfully stopped
   * @example
   * apiCoverage.stopTracking(); // Stop tracking with stored client
   * apiCoverage.stopTracking(axios); // Stop tracking with specific client
   */
  stopTracking(client) {
    if (!this.originalRequest) {
      this.log('No tracking in progress, ignoring stopTracking call')
      return false
    }

    const targetClient = client || this.clientInstance

    if (!targetClient) {
      this.log('No client instance available to restore')
      return false
    }

    this.log(`Stopping tracking for client type: ${this.clientType}`)

    // Restore original methods based on client type
    switch (this.clientType?.toLowerCase()) {
      case 'playwright':
        // Restore original methods
        for (const [method, originalFn] of Object.entries(this.originalRequest)) {
          targetClient[method] = originalFn
        }
        break
      case 'axios':
        // Restore original methods
        targetClient.request = this.originalRequest.request
        const methodsToRestore = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']
        methodsToRestore.forEach(method => {
          if (this.originalRequest[method]) {
            targetClient[method] = this.originalRequest[method]
          }
        })
        break
      case 'fetch':
        // Restore original fetch
        // @ts-ignore - We're intentionally restoring the global fetch
        global.fetch = this.originalRequest.fetch
        break
      default:
        this.log(`Unknown client type: ${this.clientType}`)
        return false
    }

    this.originalRequest = null
    this.clientType = null
    this.clientInstance = null
    this.log('Tracking stopped successfully')
    return true
  }

  /**
   * Get coverage statistics
   * @returns {Object} Coverage statistics
   * @property {number} total - Total number of endpoints
   * @property {number} covered - Number of covered endpoints
   * @property {number} percentage - Coverage percentage
   * @property {Array<Object>} coveredDetails - Details of covered endpoints
   * @property {Array<Object>} uncoveredEndpoints - List of uncovered endpoints
   * @example
   * const stats = apiCoverage.getCoverageStats();
   * console.log(`Coverage: ${stats.percentage}%`);
   */
  getCoverageStats() {
    const total = this.endpoints.size
    const covered = this.coverageMap.size
    const percentage = total > 0 ? (covered / total) * 100 : 0

    this.log(`Coverage stats: ${covered}/${total} (${percentage}%)`)

    const details = []
    for (const [key, info] of this.coverageMap.entries()) {
      const statusCounts = {}
      for (const [status, count] of info.statuses.entries()) {
        statusCounts[status] = count
      }
      details.push({
        method: info.method,
        path: info.path,
        statuses: statusCounts
      })
    }

    return {
      total,
      covered,
      percentage: percentage,
      coveredDetails: details,
      uncoveredEndpoints: this.#getUncoveredEndpoints()
    }
  }

  /**
   * Get list of uncovered endpoints
   * @returns {Array<Object>} List of uncovered endpoints
   * @property {string} path - Endpoint path
   * @property {string} method - HTTP method
   * @property {string} operationId - Operation ID from OpenAPI spec
   */
  #getUncoveredEndpoints() {
    const uncovered = []
    for (const [key, endpoint] of this.endpoints.entries()) {
      if (!endpoint.covered) {
        uncovered.push({
          path: endpoint.path,
          method: endpoint.method,
          operationId: endpoint.operation.operationId || 'Unknown'
        })
      }
    }
    return uncovered
  }

  /**
   * Safely write a file, creating directories if they don't exist
   * @param {string} filePath - Path to the file to write
   * @param {string} content - Content to write to the file
S   */
  async #safeWriteFile(filePath, content) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
      this.log(`Created directory: ${dir}`)
    }
    await fs.promises.writeFile(filePath, content)
    this.log(`File written successfully: ${filePath}`)
  }

  /**
   * Save current coverage state to a history file
   * @returns {Promise<void>}
   * @throws {Error} - Throws an error if file operations fail
   * @example
   * await apiCoverage.saveHistory();
   */
  async saveHistory() {
    if (!this.JSON_REPORT_HISTORY_PATH) {
      throw new Error('JSON report history path is not set in config.json')
    }
    this.log(`Saving coverage history to ${this.JSON_REPORT_HISTORY_PATH}`)

    const history = []

    for (const [key, info] of this.coverageMap.entries()) {
      const statuses = {}
      for (const [status, count] of info.statuses.entries()) {
        statuses[status] = count
      }

      // Include query parameters in history
      const queryParams = this.queryParamsCoverage.has(key) ? Array.from(this.queryParamsCoverage.get(key)) : []

      history.push({
        method: info.method,
        path: info.path,
        statuses,
        queryParams
      })
    }

    this.log(`Writing ${history.length} entries to history file`)

    if (!fs.existsSync(this.JSON_REPORT_HISTORY_PATH)) {
      await this.#safeWriteFile(this.JSON_REPORT_HISTORY_PATH, JSON.stringify(history, null, 2))
      this.log(`Created new history file with ${history.length} entries`)
    } else {
      const existing = JSON.parse(await fs.promises.readFile(this.JSON_REPORT_HISTORY_PATH, 'utf-8'))
      const merged = this.#mergeHistory(existing, history)
      await this.#safeWriteFile(this.JSON_REPORT_HISTORY_PATH, JSON.stringify(merged, null, 2))
      this.log(`Merged with existing history file, total entries: ${merged.length}`)
    }

    this.log(`Coverage history saved to ${this.JSON_REPORT_HISTORY_PATH}`)
  }

  /**
   * Merge existing and new history data
   * @param {Array<Object>} existing - Existing history data
   * @param {Array<Object>} current - Current history data
   * @returns {Array<Object>} Merged history data
   */
  #mergeHistory(existing, current) {
    const map = new Map()

    // First, process existing entries
    for (const entry of existing) {
      const key = `${entry.method} ${entry.path}`
      map.set(key, {
        ...entry,
        statuses: { ...entry.statuses },
        queryParams: entry.queryParams || []
      })
    }

    // Then, merge with current entries
    for (const entry of current) {
      const key = `${entry.method} ${entry.path}`
      if (!map.has(key)) {
        map.set(key, {
          ...entry,
          statuses: { ...entry.statuses },
          queryParams: entry.queryParams || []
        })
      } else {
        const existingEntry = map.get(key)
        for (const [status, count] of Object.entries(entry.statuses)) {
          existingEntry.statuses[status] = count
        }

        // Merge query parameters
        if (entry.queryParams) {
          existingEntry.queryParams = [...new Set([...existingEntry.queryParams, ...entry.queryParams])]
        }
      }
    }

    return Array.from(map.values())
  }

  /**
   * Generate coverage reports (JSON and HTML) from history file
   * @returns {Promise<Object>} Generated report object
   * @throws {Error} - Throws an error if file operations fail
   * @example
   * await apiCoverage.generateReport();
   */
  async generateReport() {
    if (!this.JSON_REPORT_HISTORY_PATH || !this.JSON_REPORT_PATH || !this.REPORT_PATH || !this.STATS_PATH) {
      throw new Error('Paths to coverage reports are not set in config.json')
    }
    const history = await this.#readHistory()
    const { covered, statusCountsMap, queryParamsMap } = this.#processHistory(history)

    const { endpoints, totalCoverage, totalEndpoints } = this.#buildEndpointsData(covered, statusCountsMap, queryParamsMap)

    const overallCoverage = this.#calculateOverallCoverage(totalCoverage, totalEndpoints)
    const report = this.#buildReport(endpoints, overallCoverage)

    await this.#writeReport(report)
    await this.#mergeStats(report)

    await this.#generateHtmlReport(report)

    return report
  }

  async #readHistory() {
    try {
      return JSON.parse(await fs.promises.readFile(this.JSON_REPORT_HISTORY_PATH, 'utf-8'))
    } catch (err) {
      throw new Error(`Failed to read history: ${err.message}`)
    }
  }

  #processHistory(history) {
    const covered = new Set()
    const statusCountsMap = new Map()
    const queryParamsMap = new Map()

    for (const entry of history) {
      const key = `${entry.path} ${entry.method}`
      covered.add(key)

      if (!statusCountsMap.has(key)) {
        statusCountsMap.set(key, new Map())
      }

      const statusMap = statusCountsMap.get(key)
      for (const [status, count] of Object.entries(entry.statuses)) {
        const statusCode = parseInt(status, 10)
        statusMap.set(statusCode, count)
      }

      if (entry.queryParams && entry.queryParams.length > 0) {
        if (!queryParamsMap.has(key)) {
          queryParamsMap.set(key, new Set())
        }

        const paramSet = queryParamsMap.get(key)
        for (const param of entry.queryParams) {
          paramSet.add(param)
        }
      }
    }

    return { covered, statusCountsMap, queryParamsMap }
  }

  #buildEndpointsData(covered, statusCountsMap, queryParamsMap) {
    const endpoints = []
    let totalCoverage = 0
    let totalEndpoints = 0

    for (const [key, endpoint] of this.endpoints.entries()) {
      const endpointData = this.#processEndpoint(key, endpoint, covered, statusCountsMap, queryParamsMap)
      endpoints.push(endpointData)

      totalCoverage += endpointData.totalCoverage
      totalEndpoints++
    }

    return { endpoints, totalCoverage, totalEndpoints }
  }

  #processEndpoint(key, endpoint, covered, statusCountsMap, queryParamsMap) {
    const [path, method] = key.split(' ')
    const endpointKey = `${path} ${method}`
    const isCovered = covered.has(endpointKey)

    const { statusCodes, statusCodeCoverage } = this.#processStatusCodes(endpoint, endpointKey, statusCountsMap)
    const { queryParameters, queryParamCoverage } = this.#processQueryParams(endpoint, endpointKey, queryParamsMap)

    const endpointCoverage = this.#calculateEndpointCoverage(isCovered, statusCodeCoverage, queryParamCoverage, endpoint)

    return {
      name: path,
      method,
      summary: endpoint.operation?.summary || 'No summary',
      coverage: isCovered ? 'COVERED' : 'UNCOVERED',
      totalCases: statusCodes.reduce((sum, sc) => sum + (sc.totalCases || 0), 0),
      statusCodes,
      queryParameters,
      requestCoverage: 'MISSING',
      totalCoverage: endpointCoverage,
      totalCoverageHistory: [
        {
          createdAt: new Date().toISOString(),
          totalCoverage: endpointCoverage || 0.0
        }
      ]
    }
  }

  #processStatusCodes(endpoint, endpointKey, statusCountsMap) {
    const statusCodes = []
    let statusCodeCoverage = 0
    let totalStatusCodes = 0

    if (endpoint.operation && endpoint.operation.responses) {
      totalStatusCodes = Object.keys(endpoint.operation.responses).length
      let coveredStatusCodes = 0

      for (const [statusCode, response] of Object.entries(endpoint.operation.responses)) {
        const statusCodeNum = statusCode === 'default' ? 'default' : parseInt(statusCode, 10)
        const statusCount = statusCountsMap.get(endpointKey)?.get(statusCodeNum) || 0
        const isStatusCovered = statusCount > 0

        if (isStatusCovered) {
          coveredStatusCodes++
        }

        statusCodes.push({
          value: statusCodeNum,
          totalCases: statusCount,
          description: response.description || 'No description',
          responseCoverage: isStatusCovered ? 'COVERED' : 'UNCOVERED'
        })
      }

      statusCodeCoverage = totalStatusCodes > 0 ? (coveredStatusCodes / totalStatusCodes) * 100 : 0
    }

    return { statusCodes, statusCodeCoverage }
  }

  #processQueryParams(endpoint, endpointKey, queryParamsMap) {
    const queryParameters = []
    let queryParamCoverage = 0
    let totalQueryParams = 0
    let coveredQueryParams = 0

    if (endpoint.operation && endpoint.operation.parameters) {
      totalQueryParams = endpoint.operation.parameters.filter(param => param.in === 'query').length

      for (const param of endpoint.operation.parameters) {
        if (param.in === 'query') {
          const isParamCovered = queryParamsMap.has(endpointKey) && queryParamsMap.get(endpointKey).has(param.name)

          if (isParamCovered) {
            coveredQueryParams++
          }

          queryParameters.push({
            name: param.name,
            coverage: isParamCovered ? 'COVERED' : 'UNCOVERED'
          })
        }
      }

      queryParamCoverage = totalQueryParams > 0 ? (coveredQueryParams / totalQueryParams) * 100 : 0
    }

    return { queryParameters, queryParamCoverage }
  }

  #calculateEndpointCoverage(isCovered, statusCodeCoverage, queryParamCoverage, endpoint) {
    if (this.coverageType === 'detailed') {
      if (isCovered && endpoint.operation.responses && endpoint.operation.parameters) {
        const baseCoverage = 40
        const weightedStatusCoverage = statusCodeCoverage * 0.4
        const weightedQueryParamCoverage = queryParamCoverage * 0.2
        return baseCoverage + weightedStatusCoverage + weightedQueryParamCoverage
      }
      return isCovered ? 100 : 0
    }
    return isCovered ? 100 : 0
  }

  #calculateOverallCoverage(totalCoverage, totalEndpoints) {
    return totalEndpoints > 0 ? +parseFloat(totalCoverage / totalEndpoints).toFixed(1) : 0.0
  }

  #buildReport(endpoints, overallCoverage) {
    const services = this.config?.services.map(service => ({
      key: service?.key,
      name: service?.name,
      tags: service?.tags,
      repository: service?.repository,
      swaggerUrl: service?.swaggerUrl,
      swaggerFile: service?.swaggerFile
    }))

    return {
      config: { services },
      createdAt: new Date().toISOString(),
      servicesCoverage: {
        [this.config?.services[0]?.key]: {
          endpoints,
          totalCoverage: overallCoverage,
          totalCoverageHistory: [
            {
              createdAt: new Date().toISOString(),
              totalCoverage: overallCoverage || 0.0
            }
          ]
        }
      }
    }
  }

  async #writeReport(report) {
    return await this.#safeWriteFile(this.JSON_REPORT_PATH, JSON.stringify(report, null, 2))
  }

  async #mergeStats(report) {
    try {
      const reportStats = report.servicesCoverage[this.config?.services[0]?.key].totalCoverageHistory
      if (!fs.existsSync(this.STATS_PATH)) {
        return this.#safeWriteFile(this.STATS_PATH, JSON.stringify(reportStats, null, 2))
      } else {
        const stats = JSON.parse(await fs.promises.readFile(this.STATS_PATH, 'utf-8'))
        !this.playwright && (report.servicesCoverage[this.config?.services[0]?.key].totalCoverageHistory = [...stats, ...reportStats])
        return this.#safeWriteFile(
          this.STATS_PATH,
          JSON.stringify(report.servicesCoverage[this.config?.services[0]?.key].totalCoverageHistory, null, 2)
        )
      }
    } catch (err) {
      throw new Error('ERROR adding previous run stats ' + err.message)
    }
  }

  async #generateHtmlReport(report) {
    try {
      await fs.promises.cp(this.TEMPLATE_PATH, this.REPORT_PATH, { recursive: true })
      let html = await fs.promises.readFile(this.REPORT_PATH, 'utf-8')
      html = html.replace(
        /<script id="state" type="application\/json">[\s\S]*?<\/script>/,
        `<script id="state" type="application/json">${JSON.stringify(report, null, 2)}</script>`
      )
      !this.playwright && (await fs.promises.unlink(this.JSON_REPORT_HISTORY_PATH))
      return this.#safeWriteFile(this.REPORT_PATH, html)
    } catch (err) {
      throw new Error('ERROR copying template HTML file ' + err.message)
    }
  }

  /**
   * Reset coverage tracking (useful between test runs)
   * @returns {void}
   * @example
   * apiCoverage.resetCoverage(); // Reset all coverage data
   */
  resetCoverage() {
    this.coverageMap = new Map()
    this.queryParamsCoverage = new Map()

    // Reset coverage status for all endpoints
    for (const endpoint of this.endpoints.values()) {
      endpoint.covered = false
    }

    this.log('Coverage tracking reset')
  }
}
