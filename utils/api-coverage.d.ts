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
export interface OpenAPISpec {
  paths?: Record<string, any>
  basePath?: string
  servers?: Array<{ url: string }>
  info: anysetDebug
  components?: any
  jsonSchemaDialect?: string
  webhooks?: any
}

/**
 * @typedef {Object} ServiceConfig
 * @property {string} key - Service key
 * @property {string} name - Service name
 * @property {string[]} tags - Service tags
 * @property {string} repository - Service repository URL
 * @property {string} swaggerUrl - Swagger/OpenAPI spec URL
 * @property {string} swaggerFile - Local Swagger/OpenAPI spec file path
 */
export interface ServiceConfig {
  key: string
  name: string
  tags: string[]
  repository: string
  swaggerUrl?: string
  swaggerFile?: string
}

/**
 * Configuration object for ApiCoverage
 */
export interface ApiCoverageConfig {
  services: ServiceConfig[]
  'report-path': string
  'html-report-path'?: string
  source?: string
}

/**
 * Options for startTracking method
 */
export interface StartTrackingOptions {
  clientType?: 'playwright' | 'axios' | 'fetch'
  coverage?: 'basic' | 'detailed'
}

/**
 * Coverage statistics returned by getCoverageStats
 */
export interface CoverageStats {
  total: number
  covered: number
  percentage: number
  coveredDetails: Array<{
    method: string
    path: string
    statuses: Record<string, number>
  }>
  uncoveredEndpoints: Array<{
    path: string
    method: string
    operationId: string
  }>
}

/**
 * Class for tracking API coverage and generating coverage reports
 */
export class ApiCoverage {
  /**
   * Create a new ApiCoverage instance
   * @param config - Configuration object
   */
  constructor(config: ApiCoverageConfig)

  /**
   * Enable or disable debug logging
   * @param {string} level - Log level ('info', 'debug', 'error')
   * @param {boolean} enabled - Whether to enable debug logging
   * @example
   * apiCoverage.setDebug(true); // Enable debug logging
   * apiCoverage.setDebug(false); // Disable debug logging
   */
  setDebug(enabled: boolean, level?: string): void

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
  loadSpec(source: string): Promise<OpenAPISpec>

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
  startTracking(client: any, options?: StartTrackingOptions): Promise<boolean>

  /**
   * Stop tracking API requests and restore original methods
   * @param {Object} [client] - HTTP client instance (optional, will use stored instance if not provided)
   * @returns {boolean} - Whether tracking was successfully stopped
   * @example
   * apiCoverage.stopTracking(); // Stop tracking with stored client
   * apiCoverage.stopTracking(axios); // Stop tracking with specific client
   */
  stopTracking(client?: any): boolean

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
  getCoverageStats(): CoverageStats

  /**
   * Generate coverage reports (JSON and HTML) from history file
   * @returns {Promise<Object>} Generated report object
   * @throws {Error} - Throws an error if file operations fail
   * @example
   * await apiCoverage.generateReport();
   */
  generateReport(): Promise<any>

  /**
   * Reset coverage tracking (useful between test runs)
   * @returns {void}
   * @example
   * apiCoverage.resetCoverage(); // Reset all coverage data
   */
  resetCoverage(): void

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
  registerPostmanRequests(collection: any, options?: any): Promise<void>
}
