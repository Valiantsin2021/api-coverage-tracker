import { expect, test } from '@fixtures/fixture.js'
import { ApiCoverage } from 'api-coverage-tracker'
import config from '../config.json' with { type: 'json' }

const apiCoverage = new ApiCoverage(config)
const HISTORY_PATH = './coverage/coverage-history.json'
const FINAL_REPORT = './coverage/coverage-report.json'
await apiCoverage.loadSpec('https://petstore.swagger.io/v2/swagger.json')

test.beforeEach(async ({ request }) => {
  apiCoverage.startTracking(request, { clientType: 'playwright', coverage: 'basic' })
})

test.afterEach(async ({ request }) => {
  await apiCoverage.saveHistory(HISTORY_PATH)
  apiCoverage.stopTracking(request) // always runs even on test failure
})
test.afterAll(async () => {
  await apiCoverage.generateReport(FINAL_REPORT, HISTORY_PATH)
})
test.describe.configure({ mode: 'default' })
const baseUrl = 'https://petstore.swagger.io/v2'
const testPet = {
  id: 12345,
  name: 'TestDog',
  category: {
    id: 1,
    name: 'Dogs'
  },
  photoUrls: ['https://example.com/dog.jpg'],
  tags: [
    {
      id: 1,
      name: 'friendly'
    }
  ],
  status: 'available'
}

const testOrder = {
  id: 1,
  petId: 12345,
  quantity: 1,
  shipDate: new Date().toISOString(),
  status: 'placed',
  complete: false
}

const testUser = {
  id: 1,
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  password: 'password123',
  phone: '1234567890',
  userStatus: 1
}

// Authorization keys
const apiKey = 'special-key'

test.describe('Pet Store API Tests', () => {
  // PET ENDPOINTS
  test.describe('Pet Endpoints', () => {
    test('Add a new pet to the store', async ({ request }) => {
      const response = await request.post(`${baseUrl}/pet`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: testPet
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody.id).toBe(testPet.id)
      expect.soft(responseBody.name).toBe(testPet.name)
    })

    test('Update an existing pet', async ({ request }) => {
      const updatedPet = { ...testPet, name: 'UpdatedDog' }

      const response = await request.put(`${baseUrl}/pet`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: updatedPet
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody.name).toBe('UpdatedDog')
    })

    test('Find pets by status', async ({ request }) => {
      const response = await request.get(`${baseUrl}/pet/findByStatus?status=available`)

      expect.soft(response.status()).toBe(200)
      const pets = await response.json()
      expect.soft(Array.isArray(pets)).toBeTruthy()

      // Validate structure of first pet (if available)
      if (pets.length > 0) {
        const pet = pets[0]
        expect.soft(pet).toHaveProperty('id')
        expect.soft(pet).toHaveProperty('name')
        expect.soft(pet).toHaveProperty('photoUrls')
      }
    })

    test('Find pets by invalid status - expect 400', async ({ request }) => {
      const response = await request.get(`${baseUrl}/pet/findByStatus?status=invalidStatus`)
      expect.soft(response.status()).toBe(400)
    })

    test('Find pets by tags (deprecated)', async ({ request }) => {
      const response = await request.get(`${baseUrl}/pet/findByTags?tags=friendly`)

      expect.soft(response.status()).toBe(200)
      const pets = await response.json()
      expect.soft(Array.isArray(pets)).toBeTruthy()
    })

    test('Find pet by ID', async ({ request }) => {
      // First ensure the pet exists by creating it
      await request.post(`${baseUrl}/pet`, {
        headers: { 'Content-Type': 'application/json' },
        data: testPet
      })

      const response = await request.get(`${baseUrl}/pet/${testPet.id}`, {
        headers: {
          api_key: apiKey
        }
      })

      expect.soft(response.status()).toBe(200)
      const pet = await response.json()
      expect.soft(pet.id).toBe(testPet.id)
      expect.soft(pet.name).toBe(testPet.name)
    })

    test('Find pet with invalid ID - expect 400', async ({ request }) => {
      const response = await request.get(`${baseUrl}/pet/invalidId`, {
        headers: {
          api_key: apiKey
        }
      })

      expect.soft(response.status()).toBe(400)
    })

    test('Find non-existent pet - expect 404', async ({ request }) => {
      const response = await request.get(`${baseUrl}/pet/99999999`, {
        headers: {
          api_key: apiKey
        }
      })

      // If the API correctly handles non-existent IDs, it should return 404
      // But some implementations might return different errors
      expect.soft([404, 400]).toContain(response.status())
    })

    test('Update a pet with form data', async ({ request }) => {
      const response = await request.post(`${baseUrl}/pet/${testPet.id}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
          name: 'UpdatedFormDog',
          status: 'pending'
        }
      })

      expect.soft(response.status()).toBe(200)

      // Verify update was successful by getting the pet
      const getResponse = await request.get(`${baseUrl}/pet/${testPet.id}`, {
        headers: {
          api_key: apiKey
        }
      })

      const updatedPet = await getResponse.json()
      expect.soft(updatedPet.name).toBe('UpdatedFormDog')
      expect.soft(updatedPet.status).toBe('pending')
    })

    test('Upload an image to a pet', async ({ request }) => {
      // Create a simple form data with image placeholder
      const formData = new FormData()
      formData.append('additionalMetadata', 'Test image')

      // In a real test, you would append an actual file here
      // This is a placeholder for demonstration
      const file = new File(['dummy content'], 'test-image.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const response = await request.post(`${baseUrl}/pet/${testPet.id}/uploadImage`, {
        headers: {
          // The browser will set the appropriate content-type with boundary
        },
        data: formData
      })

      expect.soft(response.status()).toBe(200)
      const result = await response.json()
      expect.soft(result).toHaveProperty('code')
      expect.soft(result).toHaveProperty('message')
    })

    test('Delete a pet', async ({ request }) => {
      const response = await request.delete(`${baseUrl}/pet/${testPet.id}`, {
        headers: {
          api_key: apiKey
        }
      })

      expect.soft(response.status()).toBe(200)

      // Verify deletion by trying to get the pet (should return 404)
      const getResponse = await request.get(`${baseUrl}/pet/${testPet.id}`, {
        headers: {
          api_key: apiKey
        }
      })

      expect.soft(getResponse.status()).toBe(404)
    })

    test('Delete pet with invalid ID - expect 400', async ({ request }) => {
      const response = await request.delete(`${baseUrl}/pet/invalidId`, {
        headers: {
          api_key: apiKey
        }
      })

      expect.soft(response.status()).toBe(400)
    })
  })

  // STORE ENDPOINTS
  test.describe('Store Endpoints', () => {
    test('Get inventory status', async ({ request }) => {
      const response = await request.get(`${baseUrl}/store/inventory`, {
        headers: {
          api_key: apiKey
        }
      })

      expect.soft(response.status()).toBe(200)
      const inventory = await response.json()
      expect.soft(typeof inventory).toBe('object')

      // Inventory should have some status keys like "available", "pending", etc.
      // But we don't know exactly which ones will be present
    })

    test('Place an order for a pet', async ({ request }) => {
      const response = await request.post(`${baseUrl}/store/order`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: testOrder
      })

      expect.soft(response.status()).toBe(200)
      const order = await response.json()
      expect.soft(order.id).toBe(testOrder.id)
      expect.soft(order.petId).toBe(testOrder.petId)
      expect.soft(order.status).toBe(testOrder.status)
    })

    test('Place an invalid order - expect 400', async ({ request }) => {
      const invalidOrder = { ...testOrder, status: 'invalid_status' }

      const response = await request.post(`${baseUrl}/store/order`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: invalidOrder
      })

      expect.soft(response.status()).toBe(400)
    })

    test('Find purchase order by ID', async ({ request }) => {
      // First ensure the order exists by creating it
      await request.post(`${baseUrl}/store/order`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: testOrder
      })

      const response = await request.get(`${baseUrl}/store/order/${testOrder.id}`)

      expect.soft(response.status()).toBe(200)
      const order = await response.json()
      expect.soft(order.id).toBe(testOrder.id)
      expect.soft(order.petId).toBe(testOrder.petId)
    })

    test('Find order with ID out of range - expect 400', async ({ request }) => {
      // The spec says valid IDs are between 1 and 10
      const response = await request.get(`${baseUrl}/store/order/11`)
      expect.soft(response.status()).toBe(400)
    })

    test('Find non-existent order - expect 404', async ({ request }) => {
      // First delete the order if it exists
      await request.delete(`${baseUrl}/store/order/${testOrder.id}`)

      const response = await request.get(`${baseUrl}/store/order/${testOrder.id}`)
      expect.soft(response.status()).toBe(404)
    })

    test('Delete purchase order by ID', async ({ request }) => {
      // First ensure the order exists by creating it
      await request.post(`${baseUrl}/store/order`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: testOrder
      })

      const response = await request.delete(`${baseUrl}/store/order/${testOrder.id}`)

      expect.soft(response.status()).toBe(200)

      // Verify deletion by trying to get the order (should return 404)
      const getResponse = await request.get(`${baseUrl}/store/order/${testOrder.id}`)
      expect.soft(getResponse.status()).toBe(404)
    })

    test('Delete order with invalid ID - expect 400', async ({ request }) => {
      const response = await request.delete(`${baseUrl}/store/order/invalidId`)
      expect.soft(response.status()).toBe(400)
    })
  })

  // USER ENDPOINTS
  test.describe('User Endpoints', () => {
    test('Create a new user', async ({ request }) => {
      const response = await request.post(`${baseUrl}/user`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: testUser
      })

      expect.soft(response.status()).toBe(200)
    })

    test('Create users with array', async ({ request }) => {
      const users = [testUser, { ...testUser, id: 2, username: 'testuser2' }]

      const response = await request.post(`${baseUrl}/user/createWithArray`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: users
      })

      expect.soft(response.status()).toBe(200)
    })

    test('Create users with list', async ({ request }) => {
      const users = [testUser, { ...testUser, id: 2, username: 'testuser2' }]

      const response = await request.post(`${baseUrl}/user/createWithList`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: users
      })

      expect.soft(response.status()).toBe(200)
    })

    test('Login user', async ({ request }) => {
      const response = await request.get(`${baseUrl}/user/login?username=${testUser.username}&password=${testUser.password}`)

      expect.soft(response.status()).toBe(200)

      // API should return session token
      const responseBody = await response.text()
      expect.soft(responseBody).toBeTruthy()

      // Check for expected headers
      const headers = response.headers()
      expect.soft(headers).toHaveProperty('x-rate-limit')
      expect.soft(headers).toHaveProperty('x-expires-after')
    })

    test('Login with invalid credentials - expect 400', async ({ request }) => {
      const response = await request.get(`${baseUrl}/user/login?username=invaliduser&password=invalidpass`)

      expect.soft(response.status()).toBe(400)
    })

    test('Logout user', async ({ request }) => {
      const response = await request.get(`${baseUrl}/user/logout`)
      expect.soft(response.status()).toBe(200)
    })

    test('Get user by username', async ({ request }) => {
      // First ensure the user exists by creating it
      await request.post(`${baseUrl}/user`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: testUser
      })

      const response = await request.get(`${baseUrl}/user/${testUser.username}`)

      expect.soft(response.status()).toBe(200)
      const user = await response.json()
      expect.soft(user.username).toBe(testUser.username)
      expect.soft(user.firstName).toBe(testUser.firstName)
      expect.soft(user.lastName).toBe(testUser.lastName)
    })

    test('Get non-existent user - expect 404', async ({ request }) => {
      const response = await request.get(`${baseUrl}/user/nonexistentuser`)
      expect.soft(response.status()).toBe(404)
    })

    test('Update user', async ({ request }) => {
      // First ensure the user exists by creating it
      await request.post(`${baseUrl}/user`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: testUser
      })

      const updatedUser = {
        ...testUser,
        firstName: 'UpdatedFirstName',
        email: 'updated@example.com'
      }

      const response = await request.put(`${baseUrl}/user/${testUser.username}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: updatedUser
      })

      expect.soft(response.status()).toBe(200)

      // Verify update was successful by getting the user
      const getResponse = await request.get(`${baseUrl}/user/${testUser.username}`)
      const retrievedUser = await getResponse.json()
      expect.soft(retrievedUser.firstName).toBe(updatedUser.firstName)
      expect.soft(retrievedUser.email).toBe(updatedUser.email)
    })

    test('Update non-existent user - expect 404', async ({ request }) => {
      const response = await request.put(`${baseUrl}/user/nonexistentuser`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: testUser
      })

      expect.soft(response.status()).toBe(404)
    })

    test('Delete user', async ({ request }) => {
      // First ensure the user exists by creating it
      await request.post(`${baseUrl}/user`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: testUser
      })

      const response = await request.delete(`${baseUrl}/user/${testUser.username}`)

      expect.soft(response.status()).toBe(200)

      // Verify deletion by trying to get the user (should return 404)
      const getResponse = await request.get(`${baseUrl}/user/${testUser.username}`)
      expect.soft(getResponse.status()).toBe(404)
    })

    test('Delete non-existent user - expect 404', async ({ request }) => {
      const response = await request.delete(`${baseUrl}/user/nonexistentuser`)
      expect.soft(response.status()).toBe(404)
    })
  })
})
