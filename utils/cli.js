#!/usr/bin/env node

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = JSON.parse(readFileSync(resolve(__dirname, '../config.json'), 'utf8'))

import { ApiCoverage } from '../utils/api-coverage.js'

function parseArgs(args) {
  const params = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      params[key] = args[i + 1]
      i++
    }
  }
  return params
}

async function run() {
  const args = process.argv.slice(2)
  const params = parseArgs(args)

  const { spec, collection, coverage = 'basic' } = params

  if (!spec || !collection) {
    console.error(`
Usage: api-coverage-tracker --spec <specPath> --collection <collectionPath> [--coverage <type>]

Arguments:
  --spec        URL or path to OpenAPI/Swagger specification
  --collection  Path to Postman collection JSON file
  --coverage    Coverage type: 'basic' or 'detailed' (default: 'basic')

Example:
  npx api-coverage-tracker --spec https://api.example.com/swagger.json --collection ./collection.json --coverage detailed
`)
    process.exit(1)
  }

  try {
    const apiCoverage = new ApiCoverage(config)
    await apiCoverage.loadSpec(spec)
    apiCoverage.registerPostmanRequests({
      collectionPath: resolve(process.cwd(), collection),
      coverage
    })
    await apiCoverage.saveHistory()
    await apiCoverage.generateReport()
    console.log('API coverage report generated successfully.')
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

run().catch(console.error)
