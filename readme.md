<h1 align="center">Universal API Coverage Tracker</h1>
</p>
<p align="center">
   <a href="https://github.com/Valiantsin2021/api-coverage-tracker/tags/"><img src="https://img.shields.io/github/tag/Valiantsin2021/api-coverage-tracker" alt="playwwright-performance versions" /></a>
   <a href="https://www.npmjs.com/package/api-coverage-tracker"><img alt="api-coverage-tracker available on NPM" src="https://img.shields.io/npm/dy/api-coverage-tracker"></a>
   <a href="http://makeapullrequest.com"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs are welcome" /></a>
   <a href="https://github.com/Valiantsin2021/api-coverage-tracker/issues/"><img src="https://img.shields.io/github/issues/Valiantsin2021/api-coverage-tracker" alt="api-coverage-tracker issues" /></a>
   <img src="https://img.shields.io/github/stars/Valiantsin2021/api-coverage-tracker" alt="api-coverage-tracker stars" />
   <img src="https://img.shields.io/github/forks/Valiantsin2021/api-coverage-tracker" alt="api-coverage-tracker forks" />
   <img src="https://img.shields.io/github/license/Valiantsin2021/api-coverage-tracker" alt="api-coverage-tracker license" />
   <a href="https://GitHub.com/Valiantsin2021/api-coverage-tracker/graphs/commit-activity"><img src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" alt="api-coverage-tracker is maintained" /></a>
   <a href="https://github.com/Valiantsin2021/api-coverage-tracker"><img src="https://img.shields.io/badge/Author-Valentin%20Lutchanka-blue" alt="api-coverage-tracker author" /></a>
   <a href="https://github.com/Valiantsin2021/api-coverage-tracker/actions/workflows/ci.yml"><img src="https://github.com/Valiantsin2021/api-coverage-tracker/actions/workflows/playwright.yml/badge.svg?branch=main" alt="api-coverage-tracker ci tests" /></a>
  <a href="https://img.shields.io/badge/Postman-FF6C37?logo=postman&logoColor=white"><img src="https://img.shields.io/badge/Postman-FF6C37?logo=postman&logoColor=white" alt="postman" /></a>
  <a href="https://img.shields.io/badge/OpenAPI-5392CE?logo=openapi&logoColor=white"><img src="https://img.shields.io/badge/OpenAPI-5392CE?logo=openapi&logoColor=white" alt="openapi" /></a>
  <a href="https://img.shields.io/badge/Swagger-85EA2D?logo=swagger&logoColor=white"><img src="https://img.shields.io/badge/Swagger-85EA2D?logo=swagger&logoColor=white" alt="swagger" /></a>
  </p>  
  <h3 align="center">A universal library for tracking API coverage against OpenAPI/Swagger specifications. This library can work with various HTTP clients including Playwright, Axios, Fetch, and more (via register of the response in the exposed method).</h3>


Acknoledgements to Nikita Filonov for Idea and great standalone HTML report file- https://github.com/Nikita-Filonov

This library aimed to provide the automated API coverage measurement functionality for main JavaScript API clients and tools.

It calculates the API testing coverage based on the endpoints, status codes per endpoint, query parameters per endpoint covered. 

For Axios and Fetch clients, it also tracks the previous coverage statistics.

For Postman collections it also tracks the previous coverage statistics. Supports run from the command line.

## [Coverage Report sample](https://valiantsin2021.github.io/api-coverage-tracker)

## Features

- Automated HTML report generation
- Load OpenAPI/Swagger specifications from files or URLs
- Track API requests made through various HTTP clients
- Generate coverage reports showing which endpoints are covered
- Support for both OpenAPI 2.0 (Swagger) and OpenAPI 3.0+ specifications
- Saves and reflects in report the history of coverage changes
- Basic and detailed levels of coverage calculation
- Compatible with multiple HTTP clients:
  - Playwright
  - Axios
  - Fetch
  - Custom HTTP clients (via manual registration)
  - Postman collections coverage calculation agains openAPI specification (cli or inline script)

## Important changes between 2.0.0 and 1.6.1 versions:

- Methods `saveHistory` is removed and no more needed.
- config.json file obligatory fields are updated. Now only the base path to reports files should be provided in the config.json file - see the below example. 
- History of the coverage changes is now reflected in HTML report and stored individually per service for all supported clients
- History is tracked for test runs with as minimum of 10 minutes intervals (this limitation is made to unify the behaviour between clients because the Playwright spawns new workers if API test fails and this is causing the reset of the stats)
- Support for Postman collections coverage calculation agains openAPI specification with cli command or inlline script
- To maintain the history of the test coverage - do not delete appropriate service json files from the output directory

## Installation

```bash
npm install -D api-coverage-tracker
```
## Configuration

The library requires a configuration object with service information:


- services: An array of service objects (APIs) with the following properties:
  - key: A unique identifier for the service (obligatory)
  - name: The name of the service
  - tags: An array of tags associated with the service
  - repository: The repository URL for the service
  - swaggerUrl: The URL of the OpenAPI/Swagger specification (obligatory if no swaggerFile is provided)
  - swaggerFile: The local path to the OpenAPI/Swagger specification file (obligatory if no swaggerUrl is provided)
- report-path: The path to save the statistics and reports file (obligatory)

```json
// config.json example
{
  "html-report-path": "./coverage/report.html",
  "services": [
    {
      "key": "petstore",
      "name": "Petstore API",
      "tags": ["api", "pets"],
      "repository": "https://github.com/example/petstore",
      "swaggerUrl": "https://petstore.swagger.io/v2/swagger.json",
      "swaggerFile": "./specs/petstore.json"
    }
  ],
  "report-path": "./reports"
}
```

## Usage

### Basic Usage

```javascript
import { ApiCoverage } from 'api-coverage-tracker'
import config from './config.json' with { type: 'json' }

const apiCoverage = new ApiCoverage(config)
// Load the API specification
await apiCoverage.loadSpec('./swagger.json');

// Start tracking requests (with your preferred HTTP client)
apiCoverage.startTracking(httpClient, { clientType: 'clientType' }); // clientType = playwright | axios | fetch

// Make API requests...

// Stop tracking when done
apiCoverage.stopTracking();

// Get coverage statistics
const stats = apiCoverage.getCoverageStats();
console.log('Coverage stats:', stats);
```

### With Playwright

without fixture

```javascript
import { test } from '@playwright/test';
import { ApiCoverage } from 'api-coverage-tracker'
import config from './config.json' with { type: 'json' }

const apiCoverage = new ApiCoverage(config)
await apiCoverage.loadSpec('https://fakestoreapi.com/fakestoreapi.json')

test.beforeEach(async ({ request }) => {
  apiCoverage.startTracking(request, { clientType: 'playwright' })
})

test.afterEach(async ({ request }) => {
  apiCoverage.stopTracking(request) // always runs even on test failure
})
test.afterAll(async () => {
  const report = apiCoverage.generateReport()
})
test('API coverage test', async ({ request }) => {

  // Make API requests
  const response = await request.get('/api/pets');
  expect(petstporeResponse).toBeOK()
});
```

with fixture

```javascript
// fixture.js

import * as base from '@playwright/test'
import { ApiCoverage } from 'api-coverage-tracker'
import config from '../config.json' with { type: 'json' }

export { expect } from '@playwright/test'
const apiCoverage = new ApiCoverage(config)
await apiCoverage.loadSpec('https://parabank.parasoft.com/parabank/services/bank/openapi.yaml')
apiCoverage.setDebug(false)

const extension = {
  testHook: [
    async ({ request }, use) => {
      apiCoverage.startTracking(request, { clientType: 'playwright', coverage: 'basic' })
      await use()
      apiCoverage.stopTracking(request)
      await apiCoverage.generateReport()
    },
    { auto: true, scope: 'test' }
  ]
}
export const test = base.test.extend(extension)

// test file

import { expect, test } from '@fixtures/fixture.js'

test('POST Start JMS Listener /startupJmsListener', async ({ request }) => {
  const response = await request.post('startupJmsListener')
  expect.soft(response.status()).toBe(204)
})
test('POST Clean the Database /cleanDatabase', async ({ request }) => {
  const response = await request.post('cleanDB')
  expect.soft(response.status()).toBe(204)
})
test('POST Initialize the Database /initializeDatabase', async ({ request }) => {
  const response = await request.post('initializeDB')
  expect.soft(response.status()).toBe(204)
})
test('POST Set Parameters /setParameter/:name/:value', async ({ request }) => {
  const response = await request.post(`setParameter/product/account`)
  expect.soft(response.status()).toBe(204)
})

```

### With Axios

```javascript
import { ApiCoverage } from 'api-coverage-tracker'
import axios from 'axios'
import config from './config.json' with { type: 'json' }
const apiCoverage = new ApiCoverage(config)

async function testApi() {
  // Load the API specification
  await apiCoverage.loadSpec('./swagger.json');
  
  // Create an Axios instance
  const axiosInstance = axios.create({
    baseURL: 'https://api.example.com'
  });
  
  apiCoverage.startTracking(axiosInstance, { clientType: 'axios', coverage: 'detailed' });
  
  try {
    const response = await axiosInstance.get('/users');
    console.log('Users:', response.data);
  } finally {
    apiCoverage.stopTracking(axiosInstance);
    const stats = apiCoverage.getCoverageStats();
    console.log('Coverage stats:', stats);

    apiCoverage.generateReport()
  }
}
```

### With Fetch

```javascript
import { ApiCoverage } from 'api-coverage-tracker'
import config from './config.json' with { type: 'json' }
const apiCoverage = new ApiCoverage(config)

async function testApi() {
  await apiCoverage.loadSpec('./swagger.json');
  apiCoverage.startTracking(global.fetch, { clientType: 'fetch' });
  
  try {
    const response = await fetch('https://api.example.com/users');
    const users = await response.json();
    console.log('Users:', users);
  } finally {
    apiCoverage.stopTracking();
    
    const stats = apiCoverage.getCoverageStats();
    console.log('Coverage stats:', stats);

    apiCoverage.generateReport()
  }
}
```

### Manual Registration

If you're using a custom HTTP client or want to manually register requests:

```javascript
import { ApiCoverage } from 'api-coverage-tracker'
import config from './config.json' with { type: 'json' }
const apiCoverage = new ApiCoverage(config)

async function testApi() {
  await apiCoverage.loadSpec('./swagger.json');
  
  const response = await someCustomHttpClient.get('/users');
  
  apiCoverage.registerRequest('GET', '/users', response);
  
  const stats = apiCoverage.getCoverageStats();
  console.log('Coverage stats:', stats);

  apiCoverage.generateReport()
}
```

### Cypress example:

```javascript
// cypress.config.js

setupNodeEvents(on, config) {
    
  // Task to register an API request
  registerApiRequest({ method, url, response }) {
    apiCoverage.registerRequest(method, url, response)
    return null
  },
  // Task to generate the API coverage report
  generateApiReport() {
    return apiCoverage.generateReport().then(() => {
      console.log('API coverage report generated')
      return null
    })
  },
}

// Hooks

before(() => {
  cy.task('loadApiSpec', './automation-excersize-spec.json').then(() => {
    Cypress.log({ name: 'API Coverage', message: 'Spec loaded successfully' })
  })
})
after(() => {
  cy.task('generateApiReport').then(() => {
    Cypress.log({ name: 'API Coverage', message: 'Report generated' })
  })
})

// test

it('API coverage test', () => {
  cy.api({ url: productsList })
  .then(response => {
    cy.registerApiRequest('GET', '/api/productsList', response)
    const body = JSON.parse(response.body)
    expect(body['products'], 'Assert body["products"] is array').to.be.an('array')      
  })
})
```

### Postman example (cli):

```bash
npx api-coverage-tracker --spec 'https://fakestoreapi.com/fakestoreapi.json' --collection './e2e/data/FakeStoreAPI.postman_collection.json' --coverage basic

```

### Postman example (inline):

```javascript
import config from '../config.json' with { type: 'json' }
import { ApiCoverage } from 'api-coverage-tracker'

const apiCoverage = new ApiCoverage(config)
const openAPISpec = 'https://fakestoreapi.com/fakestoreapi.json'
const collectionPath = './e2e/data/FakeStoreAPI.postman_collection.json'
await apiCoverage.loadSpec(openAPISpec)
await apiCoverage.registerPostmanRequests({ collectionPath, coverage: 'basic' })
await apiCoverage.generateReport()

```

### Saving and Loading Coverage History occurs automatically

```javascript

// Generate a final html and json reports from history
apiCoverage.generateReport();
```

### Coverage Calculation Types

The library supports two types of coverage calculation:

#### Basic Coverage (default)

In basic coverage mode, an endpoint is considered fully covered (100%) if it has been called at least once, regardless of status codes or query parameters. This is the default behavior and is useful for basic coverage tracking.

```javascript
// Use basic coverage (default) other option - "detailed"
apiCoverage.startTracking(httpClient, { clientType: 'axios', coverage: 'basic' });
```

#### Detailed Coverage

In detailed coverage mode, the coverage calculation is more nuanced and considers multiple factors:

1. **Base Coverage (40%)**: Awarded if the endpoint has been called at least once
2. **Status Code Coverage (40%)**: Based on the percentage of possible status codes that have been tested
3. **Query Parameter Coverage (20%)**: Based on the percentage of query parameters that have been used

Special cases:
- If an endpoint has only one status code and no query parameters, it's considered 100% covered when called
- If an endpoint has only one status code but has query parameters, base coverage is 60% and query parameter coverage is 40%
- If an endpoint has multiple status codes but no query parameters, base coverage is 60% and status code coverage is 40%

```javascript
// Use detailed coverage
apiCoverage.startTracking(httpClient, { clientType: 'axios', coverage: 'detailed' });
```

## Debug Mode

Enable debug logging to see detailed information about coverage tracking:

```javascript
apiCoverage.setDebug(true);
```

## API Reference


### `loadSpec(source)`

Load an OpenAPI/Swagger specification from a file or URL.

- `source`: Path to the Swagger/OpenAPI spec file or URL
- Returns: Promise resolving to the parsed API specification

### `setDebug(enabled)`

Enable or disable debug logging.

- `enabled`: Boolean indicating whether to enable debug logging

### `startTracking(client, options)`

Start tracking API requests made through the specified HTTP client with configuration options.

- `client`: HTTP client instance (Playwright APIRequestContext, Axios instance, etc.)
- `options`: Configuration object
  - `options.clientType`: Type of client ('playwright', 'axios', 'fetch', etc.)
  - `options.coverage`: Coverage calculation type ('basic' or 'detailed')


### `stopTracking(client)`

Stop tracking API requests and restore the original client methods.

- `client`: HTTP client instance (optional, will use stored instance if not provided)

### `registerRequest(method, path, response, queryParams)`

Manually register a request as covered.

- `method`: HTTP method (GET, POST, etc.)
- `path`: Request path (/api/users, etc.)
- `response`: Response object with status() or status property
- `queryParams`: Optional query parameters used in the request (object)

### `getCoverageStats()`

Get coverage statistics.

- Returns: Object containing coverage statistics

### `generateReport()`

Generate coverage report from history file.

### `resetCoverage()`

Reset coverage tracking (useful between test runs).

## License

MIT 
