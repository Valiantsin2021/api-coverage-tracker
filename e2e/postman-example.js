import config from '../config.json' with { type: 'json' }
import { ApiCoverage } from '../utils/api-coverage.js'

const apiCoverage = new ApiCoverage(config)
const openAPISpec = 'https://fakestoreapi.com/fakestoreapi.json'
const collectionPath = './e2e/data/FakeStoreAPI.postman_collection.json'
apiCoverage.setDebug(false)
await apiCoverage.loadSpec(openAPISpec)
await apiCoverage.registerPostmanRequests({ collectionPath, coverage: 'detailed' })
await apiCoverage.generateReport()
