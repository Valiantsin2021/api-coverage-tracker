import { test as base, expect as baseExpect, mergeExpects } from '@playwright/test'
// import { ApiCoverage } from '@utils/api-coverage'
// import { validateSchema } from 'core-ajv-schema-validator'
// const swaggerSpec = 'https://petstore.swagger.io/v2/swagger.json'
// const HISTORY_PATH = './coverage/coverage-history.json'
// const FINAL_REPORT_PATH = './coverage/final-report.json'
/**
 * @typedef {import('@playwright/test').Expect<void>} Expect
 */

/**
 * @typedef {Expect & {
 * toMatchSchema(schema: object): Promise<{message: () => string, pass: boolean}>;
 * }} CustomExpect
 */
const toMatchSchema = {
  /**
   * Custom matcher to check if a JSON object matches a given schema.
   *
   * @param {object} json - The JSON object to validate against the schema.
   * @param {object|any} schema - The schema to validate the JSON object against. This should be a Zod schema.
   * @returns {Promise<{message: () => string, pass: boolean}>} - The result of the validation. If the validation passes, `pass` is true. Otherwise, `pass` is false and an error message is provided.
   *
   */

  async toMatchSchema(json, schema) {
    const result = await schema.safeParseAsync(json)
    if (result.success) {
      return {
        message: () => 'success',
        pass: true
      }
    } else {
      return {
        message: () =>
          'Result not matching schema ' +
          result.error.issues.map(e => e.message).join('\n') +
          '\n' +
          'Details: ' +
          JSON.stringify(result.error, null, 2),
        pass: false
      }
    }
  }
}

const toMatchSchemaAJV = {
  /**
   * Custom matcher to check if a JSON object matches a given schema.
   *
   * @param {object} json - The JSON object to validate against the schema.
   * @param {object|any} schema - The schema to validate the JSON object against.
   * @param {object} options - Additional options for validation (e.g., endpoint, method, status).
   * @returns {Promise<{message: () => string, pass: boolean}>} - The result of the validation. If the validation passes, `pass` is true. Otherwise, `pass` is false and an error message is provided.
   *
   */
  async toMatchSchemaAJV(json, schema, options = {}) {
    const { errors, dataMismatches } = validateSchema(json, schema, options)
    // const mismatches = dataMismatches.filter(el => Object.values(el).filter(val => /❌|⚠️/.test(val)).length > 0)
    if (errors === null) {
      return {
        message: () => 'success',
        pass: true
      }
    } else {
      return {
        message: () =>
          'Result not matching schema. Errors: ' +
          JSON.stringify(errors, null, 2) +
          '\nData Mismatches: ' +
          JSON.stringify(dataMismatches, null, 2) +
          '\n',
        pass: false
      }
    }
  }
}

export const expect = mergeExpects(baseExpect.extend(toMatchSchema), baseExpect.extend(toMatchSchemaAJV))
export const test = base
// /**
//  * Fixture file
//  * @module Playwright_fixture fixture file to initiate POM instances
//  */
// /**
//  * @typedef {Object} APICoverage
//  * @property {object} apiCoverage
//  */

// /**
//  * @typedef {Object} Fixtures
//  * @property {APICoverage} apiCoverage
//  */
// export const test = base.extend(
//   /** @type {Fixtures} */ ({
//     apiCoverage: [
//       async ({ request }, use) => {
//         const apiCoverage = new ApiCoverage()
//         apiCoverage.startTracking(request)
//         await use(apiCoverage)
//         apiCoverage.saveHistory(HISTORY_PATH)
//         apiCoverage.stopTracking(request)
//         const report = apiCoverage.generateReport(FINAL_REPORT_PATH, HISTORY_PATH)
//         console.log(`API Coverage: ${report.coverageStats.percentage}%`)
//         if (parseFloat(report.coverageStats.percentage) < 80) {
//           console.warn('API coverage is below 80%')
//         }
//       },
//       { auto: true }
//     ]
//   })
// )
