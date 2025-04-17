/**
 * Example usage of the ApiCoverage library with different HTTP clients
 */

import { ApiCoverage } from 'api-coverage-tracker'
import axios from 'axios'
import config from '../config.json' with { type: 'json' }
const apiCoverage = new ApiCoverage(config)
// Example 1: Using with Playwright - refer to e2e directory playwright spec file

// Example 2: Using with Axios
const historyPath = './coverage/coverage-history.json'
const finalReport = './coverage/coverage-report.json'
async function exampleWithAxios() {
  try {
    // Load the API specification - use the correct path to your swagger file
    // If you don't have a local file, you can use the URL directly
    await apiCoverage.loadSpec('https://petstore.swagger.io/v2/swagger.json')

    // Enable debug logging to see what's happening
    apiCoverage.setDebug(true)

    console.log('API spec loaded successfully')

    // Create an Axios instance
    const axiosInstance = axios.create({
      baseURL: 'https://petstore.swagger.io/v2'
    })

    // Start tracking Axios requests
    apiCoverage.startTracking(axiosInstance, { clientType: 'axios', coverage: 'detailed' })

    console.log('Axios tracking started')

    // Make API requests using Axios
    console.log('Making first request...')
    const response = await axiosInstance.get('/pet/1')
    console.log('Pet data:', response.data)

    // Make another request
    console.log('Making second request...')
    const petsResponse = await axiosInstance.get('/pet/findByStatus?status=available')
    const petsResponse2 = await axiosInstance.get('/pet/findByStatus?status=available')
    const petsResponse3 = await axiosInstance.get('/pet/findByStatus?status=available')
    console.log('Available pets count:', petsResponse.data.length)

    // Get coverage statistics before stopping
    const stats = apiCoverage.getCoverageStats()
    console.log('Coverage stats before stopping:', stats)

    // Check if the coverage map has entries
    console.log('Coverage map size:', apiCoverage.coverageMap.size)

    // Stop tracking when done
    apiCoverage.stopTracking(axiosInstance)
    console.log('Axios tracking stopped')

    // Save coverage history
    await apiCoverage.saveHistory(historyPath)
    // Generate a report
    await apiCoverage.generateReport(finalReport, historyPath)
  } catch (error) {
    console.error('Error in Axios example:', error)
  }
}

// Example 3: Using with Fetch
async function exampleWithFetch() {
  // Load the API specification
  await apiCoverage.loadSpec('./apispec.json')

  // Start tracking Fetch requests
  apiCoverage.startTracking(global.fetch, { clientType: 'fetch', coverage: 'detailed' })

  try {
    // Make API requests using Fetch
    const response = await fetch('https://petstore.swagger.io/v2/pet/1')
    const petData = await response.json()
    console.log('Pet data:', petData)

    // Make another request
    const petsResponse = await fetch('https://petstore.swagger.io/v2/pet/findByStatus?status=available')
    const availablePets = await petsResponse.json()
    console.log('Available pets:', availablePets)
  } catch (error) {
    console.error('Error making requests:', error.message)
  } finally {
    // Stop tracking when done
    apiCoverage.stopTracking()

    // Get coverage statistics
    const stats = apiCoverage.getCoverageStats()
    console.log('Coverage stats:', stats)
    // Save coverage history
    await apiCoverage.saveHistory(historyPath)

    // Generate a report
    await apiCoverage.generateReport(finalReport, historyPath)
  }
}

// Example 4: Manually registering requests
async function exampleManualRegistration() {
  // Load the API specification
  await apiCoverage.loadSpec('./apispec.json')

  // Make a request using any method
  const response = await fetch('https://petstore.swagger.io/v2/pet/1')
  apiCoverage.coverageType = 'detailed'
  // Manually register the request
  apiCoverage.registerRequest('GET', '/pet/1', response)

  // Get coverage statistics
  const stats = apiCoverage.getCoverageStats()
  console.log('Coverage stats:', stats)
  // Save coverage history
  await apiCoverage.saveHistory(historyPath)

  // Generate a report
  await apiCoverage.generateReport(finalReport, historyPath)
}

// Run the examples
async function runExamples() {
  console.log('=== Example with Axios ===')
  await exampleWithAxios()

  // console.log('\n=== Example with Fetch ===')
  // await exampleWithFetch()

  // console.log('\n=== Example with Manual Registration ===')
  // await exampleManualRegistration()
}

// Uncomment to run the examples
runExamples().catch(console.error)

export { exampleManualRegistration, exampleWithAxios, exampleWithFetch }
