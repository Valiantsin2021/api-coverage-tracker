#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { ApiCoverage } from './api-coverage.js'

function printHelp() {
  console.log(`
API Coverage Tracker CLI

Commands:

  --init                    Initialize configuration file
  --spec <path>             Path to OpenAPI/Swagger specification
  --collection <path>       Path to Postman collection
  --coverage <type>         Coverage type (basic/detailed)
  --help                    Show this help message

Examples:

  # Initialize config
  npx api-coverage-tracker --init

  # Generate coverage report
  npx api-coverage-tracker --spec https://api.example.com/swagger.json --collection ./collection.json --coverage detailed
`)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const params = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help') {
      printHelp()
      process.exit(0)
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (key === 'init') {
        params.init = true
        continue
      }
      const value = args[i + 1]?.startsWith('--') ? true : args[i + 1]
      if (value) {
        params[key] = value.replace(/^['"]|['"]$/g, '')
        i++
      }
    }
  }
  return params
}

function initConfig() {
  const template = {
    services: [
      {
        key: '<service key OBLIGATORY>',
        name: '<Service API name OPTIONAL>',
        tags: ['api', 'rest'],
        repository: '<your repo>',
        swaggerUrl: '<your swagger url or leave empty if swagger file is used>',
        swaggerFile: '<your swagger file or leave empty if swagger URL is used>'
      }
    ],
    'report-path': "<relative path to the report directory, e.g. './reports'> OBLIGATORY>"
  }

  try {
    const configPath = resolve(process.cwd(), 'config.json')
    readFileSync(configPath)
    console.error('Configuration file already exists at:', configPath)
    process.exit(1)
  } catch {
    try {
      const configJson = JSON.stringify(template, null, 2)
      writeFileSync(resolve(process.cwd(), 'config.json'), configJson)
      console.log('Configuration file initialized successfully!')
      console.log('Please update the configuration with your service details.')
      process.exit(0)
    } catch (error) {
      console.error('Failed to create configuration file:', error.message)
      process.exit(1)
    }
  }
}

async function run() {
  const params = parseArgs()

  if (params.init) {
    return initConfig()
  }

  const { spec, collection, coverage = 'basic' } = params

  if (!spec || !collection) {
    printHelp()
    process.exit(1)
  }

  try {
    let config
    try {
      const configPath = resolve(process.cwd(), 'config.json')
      config = JSON.parse(readFileSync(configPath, 'utf8'))
    } catch {
      console.error('Configuration file not found. Run --init to create one.')
      process.exit(1)
    }

    const apiCoverage = new ApiCoverage(config)
    await apiCoverage.loadSpec(spec)
    await apiCoverage.registerPostmanRequests({
      collectionPath: resolve(process.cwd(), collection),
      coverage
    })
    await apiCoverage.generateReport()
    console.log('API coverage report generated successfully.')
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

run().catch(error => {
  console.error('Unexpected error:', error.message)
  process.exit(1)
})
