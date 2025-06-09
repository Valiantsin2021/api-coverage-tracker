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
