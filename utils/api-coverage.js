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
    this.BASE_PATH = config['report-path']
    this.TEMPLATE_PATH = path.resolve(__dirname, './templates/index.html')
    this.JSON_REPORT_PATH = `${config['report-path']}/report.json`
    this.JSON_REPORT_HISTORY_PATH = `${config['report-path']}/history.json`
    this.REPORT_PATH = `${config['report-path']}/report.html`
  }

  /**
   * Enable or disable debug logging
   * @param {string} level - Log level ('info', 'debug', 'error')
   * @param {boolean} enabled - Whether to enable debug logging
   * @example
   * apiCoverage.setDebug(true); // Enable debug logging
   * apiCoverage.setDebug(false); // Disable debug logging
   */
  setDebug(enabled, level = 'info') {
    this.debug = enabled
    this.level = level
  }

  /**
   * Debug log function that only logs when debug is enabled
   * @param {string} level - Log level ('info', 'debug', 'error')
   * @param {string} message - Message to log
   * @private
   */
  log(level, message) {
    if (this.debug) {
      if (this.level === 'debug') console.log(`[ApiCoverage] ${message}`)
      if (this.level === 'info') !message.includes('[DEBUG]') ? console[this.level](`[ApiCoverage] ${message}`) : null
      if (this.level === 'error') message.includes('[ERROR]') ? console[this.level](`[ApiCoverage] ${message}`) : null
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
    if (!fs.existsSync(this.JSON_REPORT_HISTORY_PATH)) {
      // Create empty history file if it doesn't exist
      await this.#safeWriteFile(this.JSON_REPORT_HISTORY_PATH, JSON.stringify([], null, 2))
      this.log('info', `[INFO] Created new empty history file at ${this.JSON_REPORT_HISTORY_PATH}`)
    }
    this.config.source = source
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
        this.apiSpec?.basePath ||
        // @ts-ignore - We know these properties exist in OpenAPI specs
        (this.apiSpec.servers && this.apiSpec.servers[0]?.url
          ? // @ts-ignore - We know these properties exist in OpenAPI specs
            this.apiSpec.servers[0].url.replace(/^https?:\/\/[^/]+/, '')
          : '')

      this.log('info', `[INFO] Loaded API spec with basePath: ${this.basePath}`)
      this.log('info', `[INFO] Parsed ${this.endpoints.size} endpoints`)

      return this.apiSpec
    } catch (error) {
      this.log('error', `[ERROR] Failed to load API spec: ${error.message}`)
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

    this.log('info', `[INFO] Parsed ${this.endpoints.size} endpoints from API spec`)
    // Log all endpoints in debug mode
    for (const [key, endpoint] of this.endpoints.entries()) {
      this.log('info', `[INFO] Registered endpoint: ${key} (regex: ${endpoint.pathRegex})`)
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
    this.log('debug', `[DEBUG] - pattern: ${pattern}`)
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
   * @param {'playwright' | 'axios' | 'fetch'} [options.clientType='playwright'] - Type of client ('playwright', 'axios', 'fetch')
   * @param {'basic' | 'detailed'} [options.coverage='basic'] - Coverage type ('basic', 'detailed')
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
      this.log('info', '[INFO] Already tracking requests, ignoring startTracking call')
      return
    }

    this.clientType = options.clientType
    this.clientInstance = client
    this.coverageType = options.coverage

    this.log('info', `[INFO] Starting tracking with client type: ${options.clientType}`)

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
   * Parse the URL and extract the pathname and query parameters
   * @param {string} url - The URL to parse
   * @returns {Object} - An object containing the pathname and query parameters
   * @property {string} pathname - The pathname of the URL
   * @property {Object} queryParams - The query parameters as key-value pairs
   * @example
   * const result = this.#parseUrlAndParams('https://api.example.com/users?id=123&active=true');
   * console.log(result.pathname); // '/users'
   * console.log(result.queryParams); // { id: '123', active: 'true' }
   * */
  #parseUrlAndParams(url) {
    let pathname
    let queryParams = {}

    try {
      const parsedUrl = new URL(url)
      this.log('debug', `[DEBUG] - url: ${url}`)
      pathname = parsedUrl.pathname
      for (const [key, value] of parsedUrl.searchParams.entries()) {
        queryParams[key] = value
      }
    } catch {
      const [path, query] = url.split('?')
      pathname = path
      if (query) {
        const params = new URLSearchParams(query)
        for (const [key, value] of params.entries()) {
          queryParams[key] = value
        }
      }
    }

    return { pathname, queryParams }
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
            const { pathname, queryParams } = this.#parseUrlAndParams(url)

            this.log('info', `[INFO] Tracking request: ${method.toUpperCase()} ${pathname}`)
            await this.#markEndpointCovered(method.toUpperCase(), pathname, response.status(), queryParams)
          } catch (error) {
            this.log('error', `[ERROR] Failed to track request: ${method} ${url} - ${error.message}`)
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
    this.log('debug', '[DEBUG] Patching Axios instance')

    // Store original methods for later restoration
    this.originalRequest = {
      request: axiosInstance.request
    }

    // Override the request method to track usage
    axiosInstance.request = async config => {
      this.log('debug', `[DEBUG] Axios request called with config: ${JSON.stringify(config)}`)

      // Call the original method
      const response = await this.originalRequest.request.call(axiosInstance, config)

      // Track this endpoint
      try {
        const method = (config.method || 'get').toUpperCase()
        const url = config.url || ''

        const { pathname, queryParams } = this.#parseUrlAndParams(url)

        this.log('info', `[INFO] Tracking Axios request: ${method} ${pathname}`)
        const result = await this.#markEndpointCovered(method, pathname, response.status, queryParams)
        this.log('info', `[INFO] Endpoint coverage result: ${result}`)
      } catch (error) {
        this.log('error', `[ERROR]: Failed to track Axios request: ${config.method} ${config.url} - ${error.message}`)
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
          this.log('debug', `[DEBUG] Axios ${method} called with url: ${url}`)

          // Call the original method
          const response = await this.originalRequest[method].call(axiosInstance, url, data, config)

          // Track this endpoint
          try {
            const { pathname, queryParams } = this.#parseUrlAndParams(url)

            this.log('debug', `[DEBUG] Tracking Axios ${method}: ${method.toUpperCase()} ${pathname}`)
            const result = await this.#markEndpointCovered(method.toUpperCase(), pathname, response.status, queryParams)
            this.log('info', `[INFO] Endpoint coverage result: ${result}`)
          } catch (error) {
            this.log('error', `[ERROR] Failed to track Axios ${method}: ${method} ${url} - ${error.message}`)
          }

          return response
        }
      }
    })

    this.log('debug', '[DEBUG] Axios instance patched successfully')
  }

  /**
   * Patch global fetch function
   * @param {Function} fetchFn - Global fetch function
   * @description Patches global fetch function to track API coverage
   */
  #patchFetch(fetchFn) {
    this.fetch = true
    this.originalRequest = {
      fetch: fetchFn
    }

    global.fetch = async (input, init) => {
      const response = await this.originalRequest.fetch(input, init)

      try {
        const method = (init?.method || 'GET').toUpperCase()

        let url
        if (typeof input === 'string') {
          url = input
        } else if (input instanceof Request) {
          url = input.url
        } else if (input && typeof input === 'object' && 'url' in input) {
          url = input.url
        } else {
          url = String(input)
        }
        this.log('debug', `[DEBUG] input type: ${typeof input}, url: ${url}`)

        // Skip tracking if URL doesn't match any API server
        if (!this.#shouldTrackRequest(url)) {
          this.log('debug', `[DEBUG] Skipping non-API request: ${url}`)
          return response
        }

        const { pathname, queryParams } = this.#parseUrlAndParams(url)

        this.log('debug', `[DEBUG] Tracking request: ${method} ${pathname}`)
        await this.#markEndpointCovered(method, pathname, response.status, queryParams)
      } catch (error) {
        this.log('error', `[ERROR] Failed to track Fetch request: ${init?.method || 'GET'} ${input} - ${error.message}`)
      }

      return response
    }
  }
  /**
   * Check if a URL should be tracked based on API servers
   * @param {string} url - URL to check
   * @returns {boolean} - Whether to track this request
   */
  #shouldTrackRequest(url) {
    if (!this.apiSpec || !this.apiSpec.servers) {
      this.log('debug', `[DEBUG] No API spec or servers defined, tracking all requests`)
      return true
    }

    try {
      const urlObj = new URL(url)
      const urlOrigin = urlObj.origin

      this.log('debug', `[DEBUG] Checking if should track: ${url} (origin: ${urlOrigin})`)

      // Check if URL matches any defined API server
      for (const server of this.apiSpec.servers) {
        try {
          const serverUrl = new URL(server.url)
          const serverOrigin = serverUrl.origin

          this.log('debug', `[DEBUG] Comparing ${urlOrigin} with server: ${server.url} (origin: ${serverOrigin})`)
          if (urlOrigin === serverOrigin) {
            this.log('debug', `[DEBUG] ✓ URL matches server origin, will track`)
            return true
          }
        } catch (e) {
          // If server.url is relative, assume we should track
          this.log('debug', `[DEBUG] Server URL is relative or invalid, will track`)
          return true
        }
      }

      this.log('debug', `[DEBUG] ✗ URL doesn't match any server origin, will skip`)
      return false
    } catch (e) {
      // If URL parsing fails, track it anyway
      this.log('debug', `[DEBUG] URL parsing failed, will track anyway: ${e.message}`)
      return true
    }
  }

  /**
   * Mark an endpoint as covered
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Request path (/api/users, etc.)
   * @param {number} statusCode - HTTP status code
   * @param {Object} [queryParams={}] - Query parameters used in the request
   * @returns {Promise<boolean>} - Whether the endpoint was successfully marked as covered
   */
  async #markEndpointCovered(method, path, statusCode, queryParams = {}) {
    this.log('info', `[INFO] Marking endpoint as covered: ${method} ${path} (status: ${statusCode})`)

    // Create a copy of the path to avoid modifying the parameter
    let normalizedPath = path.replace(/\/$/, '')

    if (this.basePath && normalizedPath.startsWith(this.basePath)) {
      normalizedPath = normalizedPath.substring(this.basePath.length)
    }

    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath
    }

    const exactKey = `${normalizedPath} ${method}`
    this.log('debug', `[DEBUG] Looking for exact match: ${exactKey}`)

    let matchedEndpointKey = null

    if (this.endpoints.has(exactKey)) {
      matchedEndpointKey = exactKey
      this.log('debug', `[DEBUG] Found exact match: ${exactKey}`)
    } else {
      this.log('debug', `[DEBUG] No exact match, trying regex matching for ${normalizedPath} ${method}`)
      for (const [key, endpoint] of this.endpoints.entries()) {
        // First check if the method matches exactly
        if (endpoint.method !== method) {
          this.log('debug', `[DEBUG] Method mismatch: ${key} !== ${normalizedPath} ${method}`)
          continue
        }

        // Then check if the path matches
        if (endpoint.pathRegex.test(normalizedPath)) {
          matchedEndpointKey = key
          this.log('debug', `[DEBUG] Found regex match: ${key}`)
          break
        }
      }
    }

    if (!matchedEndpointKey) {
      this.log('debug', `[DEBUG] No match found for: ${method} ${normalizedPath}`)
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
      this.log('info', `[INFO] Added new endpoint to coverage map: ${matchedEndpointKey}`)
    }

    const record = this.coverageMap.get(matchedEndpointKey)
    record.statuses.set(statusCode, (record.statuses.get(statusCode) || 0) + 1)
    this.log('info', `[INFO] Updated coverage for ${matchedEndpointKey} with status ${statusCode}`)
    this.log('debug', `[DEBUG] Current coverage map size: ${this.coverageMap.size}`)

    // Track query parameters if any were used
    if (Object.keys(queryParams).length > 0) {
      if (!this.queryParamsCoverage.has(matchedEndpointKey)) {
        this.queryParamsCoverage.set(matchedEndpointKey, new Set())
      }

      const paramSet = this.queryParamsCoverage.get(matchedEndpointKey)
      for (const paramName of Object.keys(queryParams)) {
        paramSet.add(paramName)
        this.log('debug', `[DEBUG] Marked query parameter as covered: ${matchedEndpointKey} - ${paramName}`)
      }
    }
    await this.#saveHistory()
    return true
  }

  /**
   * Manually register a request as covered
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Request path (/api/users, etc.)
   * @param {Object} response - Response object with status() or status property
   * @param {Object} [queryParams={}] - Query parameters used in the request
   * @param {string} [coverage='basic'] - Coverage type ('basic', 'detailed')
   * @returns {Promise<boolean>} - Whether the registration was successful
   * @example
   * apiCoverage.registerRequest('GET', '/api/users', { status: 200 }, { page: 1 });
   */
  async registerRequest(method, path, response, queryParams = {}, coverage = 'basic') {
    this.coverageType = coverage
    this.log('info', `[INFO] Manually registering: ${method} ${path}`)
    const statusCode = typeof response.status === 'function' ? response.status() : response.status
    return await this.#markEndpointCovered(method.toUpperCase(), path, statusCode, queryParams)
  }
  /**
   * Register requests from a Postman collection
   * @param {Object} params - Configuration options
   * @param {string} params.collectionPath - Path to Postman collection file
   * @param {'basic' | 'detailed'} params.coverage - Coverage type ('basic', 'detailed')
   * @returns {Promise<void>}
   * @example
   * await apiCoverage.registerPostmanRequests({
   *   collectionPath: './collection.json',
   *   coverage: 'detailed'
   * });
   */
  async registerPostmanRequests(params = { collectionPath: '', coverage: 'basic' }) {
    const { collectionPath, coverage } = params
    this.log('info', `[INFO] Registering requests from Postman collection: ${collectionPath}`)
    try {
      const requests = parser.parseCollection(collectionPath)

      // Process requests sequentially to avoid race conditions
      for (const entry of requests) {
        for (const [status, count] of Object.entries(entry.statuses)) {
          await this.registerRequest(
            entry.method,
            entry.path,
            { status: parseInt(status) },
            entry.queryParams.reduce((obj, param) => ({ ...obj, [param]: 'value' }), {}),
            coverage
          )
        }
      }

      this.log('info', '[INFO] Successfully registered Postman collection requests')
    } catch (error) {
      this.log('error', `[ERROR] Failed to register Postman collection requests: ${error.message}`)
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
      this.log('debug', '[DEBUG] No tracking in progress, ignoring stopTracking call')
      return false
    }

    const targetClient = client || this.clientInstance

    if (!targetClient) {
      this.log('debug', '[DEBUG] No client instance available to restore')
      return false
    }

    this.log('debug', `[DEBUG] Stopping tracking for client type: ${this.clientType}`)

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
        this.log('debug', `[DEBUG] Unknown client type: ${this.clientType}`)
        return false
    }

    this.originalRequest = null
    this.clientType = null
    this.clientInstance = null
    this.log('info', '[INFO] Tracking stopped successfully')
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

    this.log('info', `[INFO] Coverage stats: ${covered}/${total} (${percentage}%)`)

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
      this.log('debug', `[DEBUG] Created directory: ${dir}`)
    }
    await fs.promises.writeFile(filePath, content)
    this.log('debug', `[DEBUG] File written successfully: ${filePath}`)
  }

  /**
   * Acquire a lock for file operations
   * @param {string} lockFilePath - Path to the lock file
   * @param {number} [maxRetries=5] - Maximum number of retries
   * @param {number} [retryDelay=1000] - Delay between retries in milliseconds
   * @returns {Promise<boolean>} - Whether lock was acquired successfully
   */
  async #acquireLock(lockFilePath, maxRetries = 5, retryDelay = 1000) {
    let retries = 0
    while (retries < maxRetries) {
      try {
        await fs.promises.writeFile(lockFilePath, process.pid.toString(), { flag: 'wx' })
        this.log('debug', `[DEBUG] Lock acquired for ${lockFilePath}`)
        return true
      } catch (error) {
        if (error.code === 'EEXIST') {
          try {
            const lockContent = await fs.promises.readFile(lockFilePath, 'utf-8')
            const lockPid = parseInt(lockContent, 10)

            try {
              process.kill(lockPid, 0)
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              retries++
              continue
            } catch (killError) {
              await fs.promises.unlink(lockFilePath)
              continue
            }
          } catch (readError) {
            retries++
            continue
          }
        }
        this.log('error', `[ERROR] Error acquiring lock: ${error.message}`)
        throw error
      }
    }
    return false
  }

  /**
   * Release a file lock
   * @param {string} lockFilePath - Path to the lock file
   * @returns {Promise<void>}
   */
  async #releaseLock(lockFilePath) {
    try {
      await fs.promises.unlink(lockFilePath)
      this.log('debug', `[DEBUG] Lock released for ${lockFilePath}`)
    } catch (error) {
      this.log('error', `[ERROR]: Failed to release lock: ${error.message}`)
    }
  }

  /**
   * Save current coverage state to a history file
   * @returns {Promise<void>}
   * @throws {Error} - Throws an error if file operations fail
   */
  async #saveHistory() {
    if (!this.JSON_REPORT_HISTORY_PATH) {
      throw new Error('JSON report history path is not set in config.json')
    }
    this.log('debug', `[DEBUG] Saving coverage history to ${this.JSON_REPORT_HISTORY_PATH}`)

    const lockFilePath = `${this.JSON_REPORT_HISTORY_PATH}.lock`
    const lockAcquired = await this.#acquireLock(lockFilePath)

    if (!lockAcquired) {
      this.log('error', `[ERROR]: Failed to acquire lock for history file`)
      throw new Error('Failed to acquire lock for history file')
    }

    try {
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

      this.log('debug', `[DEBUG] Writing ${history.length} entries to history file`)

      if (!fs.existsSync(this.JSON_REPORT_HISTORY_PATH)) {
        await this.#safeWriteFile(this.JSON_REPORT_HISTORY_PATH, JSON.stringify(history, null, 2))
        this.log('debug', `[DEBUG] Created new history file with ${history.length} entries`)
      } else {
        const existing = JSON.parse(await fs.promises.readFile(this.JSON_REPORT_HISTORY_PATH, 'utf-8'))
        const merged = this.#mergeHistory(existing, history)
        await this.#safeWriteFile(this.JSON_REPORT_HISTORY_PATH, JSON.stringify(merged, null, 2))
        this.log('debug', `[DEBUG] Merged with existing history file, total entries: ${merged.length}`)
      }

      this.log('info', `[INFO] Coverage history saved to ${this.JSON_REPORT_HISTORY_PATH}`)
    } catch (err) {
      this.log('error', `[ERROR] saving coverage history: ${err.message}`)
    } finally {
      await this.#releaseLock(lockFilePath)
    }
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
    if (!this.BASE_PATH) {
      throw new Error('Paths to coverage reports are not set in config.json')
    }
    const history = await this.#readHistory()
    const { covered, statusCountsMap, queryParamsMap } = this.#processHistory(history)

    const { endpoints, totalCoverage, totalEndpoints } = this.#buildEndpointsData(covered, statusCountsMap, queryParamsMap)

    const overallCoverage = this.#calculateOverallCoverage(totalCoverage, totalEndpoints)
    const report = this.#buildReport(endpoints, overallCoverage)

    await this.#writeReport(report)

    await this.#generateHtmlReport()

    return report
  }

  async #readHistory() {
    try {
      if (!fs.existsSync(this.JSON_REPORT_HISTORY_PATH)) {
        await this.#safeWriteFile(this.JSON_REPORT_HISTORY_PATH, JSON.stringify([], null, 2))
        this.log('debug', `[DEBUG] Created new empty history file at ${this.JSON_REPORT_HISTORY_PATH}`)
        return []
      }
      return JSON.parse(await fs.promises.readFile(this.JSON_REPORT_HISTORY_PATH, 'utf-8'))
    } catch (err) {
      this.log('error', `[ERROR] reading coverage history: ${err.message}`)
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
    this.log('debug', `[DEBUG] - key: ${key}`)

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
    this.currentService = this?.config.services.find(
      service => service?.swaggerUrl === this.config.source || service?.swaggerFile === this.config.source
    )
    this.log(
      'debug',
      `Source used in client: ${this.config.source} current service swaggerUrl: ${this.currentService.swaggerUrl}, service swaggerFile: ${this.currentService.swaggerFile}`
    )

    return {
      config: { services },
      createdAt: new Date().toISOString(),
      servicesCoverage: {
        [this.currentService?.key]: {
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
    try {
      let existingReport = {}
      if (fs.existsSync(this.JSON_REPORT_PATH)) {
        existingReport = JSON.parse(await fs.promises.readFile(this.JSON_REPORT_PATH, 'utf-8'))
      }

      const mergedConfig = {
        services: [...(existingReport.config?.services || []), ...(report.config.services || [])].filter(
          (service, index, self) => index === self.findIndex(s => s.key === service.key)
        )
      }
      const mergedServicesCoverage = {
        ...(existingReport.servicesCoverage || {}),
        ...report.servicesCoverage
      }

      for (const service of mergedConfig.services) {
        if (!mergedServicesCoverage[service.key]) {
          mergedServicesCoverage[service.key] = {
            endpoints: [],
            totalCoverage: 0,
            totalCoverageHistory: [
              {
                createdAt: new Date().toISOString(),
                totalCoverage: 0
              }
            ]
          }
        }
      }

      const mergedReport = {
        config: mergedConfig,
        createdAt: new Date().toISOString(),
        servicesCoverage: mergedServicesCoverage
      }
      this.log('info', `merged report: ${mergedReport}`)
      await this.#mergeStats(mergedReport)
      return await this.#safeWriteFile(this.JSON_REPORT_PATH, JSON.stringify(mergedReport, null, 2))
    } catch (err) {
      throw new Error(`Failed to merge and write report: ${err.message}`)
    }
  }

  async #mergeStats(report) {
    const normalizedServiceKey = this.currentService.key.replace(/[^a-zA-Z0-9]/g, '')
    this.uniqueStatsPath = this.BASE_PATH + `/${normalizedServiceKey}.json`
    try {
      const currentRunStats = report.servicesCoverage[this.currentService.key].totalCoverageHistory
      const lastCurrentRunRecord = currentRunStats[currentRunStats.length - 1]
      if (!fs.existsSync(this.uniqueStatsPath)) {
        return this.#safeWriteFile(this.uniqueStatsPath, JSON.stringify([lastCurrentRunRecord], null, 2))
      }
      const existingStats = JSON.parse(await fs.promises.readFile(this.uniqueStatsPath, 'utf-8'))
      const tenMinutes = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      const filteredStats = existingStats.filter(record => {
        const recordDate = new Date(record.createdAt)
        return recordDate < tenMinutes
      })
      const mergedStats = [...filteredStats, lastCurrentRunRecord]
      report.servicesCoverage[this.currentService.key].totalCoverageHistory = mergedStats

      return this.#safeWriteFile(this.uniqueStatsPath, JSON.stringify(mergedStats, null, 2))
    } catch (err) {
      throw new Error('ERROR adding previous run stats ' + err.message)
    }
  }

  async #generateHtmlReport() {
    try {
      if (!fs.existsSync(this.REPORT_PATH)) await fs.promises.cp(this.TEMPLATE_PATH, this.REPORT_PATH, { recursive: true })
      const report = await fs.promises.readFile(this.JSON_REPORT_PATH, 'utf-8')
      let html = await fs.promises.readFile(this.REPORT_PATH, 'utf-8')
      html = html.replace(
        /<script id="state" type="application\/json">[\s\S]*?<\/script>/,
        `<script id="state" type="application/json">${report}</script>`
      )
      // await fs.promises.unlink(this.JSON_REPORT_HISTORY_PATH)
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

    this.log('info', '[INFO] Coverage tracking reset')
  }
}
