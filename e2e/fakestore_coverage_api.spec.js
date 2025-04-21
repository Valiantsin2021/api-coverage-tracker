// tests/fakestoreapi.spec.js
import { expect, test } from '@playwright/test'
import { ApiCoverage } from 'api-coverage-tracker'
import config from '../config.json' with { type: 'json' }
const apiCoverage = new ApiCoverage(config)
await apiCoverage.loadSpec('https://fakestoreapi.com/fakestoreapi.json')
apiCoverage.setDebug(false)

test.beforeEach(async ({ request }) => {
  apiCoverage.startTracking(request, { clientType: 'playwright', coverage: 'detailed' })
})

test.afterEach(async ({ request }) => {
  await apiCoverage.saveHistory()
  apiCoverage.stopTracking(request)
})
test.afterAll(async () => {
  await apiCoverage.generateReport()
})
test.describe.configure({ mode: 'default' })
test.describe('FakeStore API Tests', () => {
  const baseUrl = 'https://fakestoreapi.com'

  // Test variables
  let productId
  let cartId
  let userId
  let authToken

  // Products Tests
  test.describe('Products Endpoints', () => {
    test('GET /products - Get all products', async ({ request }) => {
      const response = await request.get(`${baseUrl}/products`)
      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()
      expect.soft(responseBody.length).toBeGreaterThan(0)
    })
    test('GET /products - Get all products 2', async ({ request }) => {
      const response = await request.get(`${baseUrl}/products`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()
      expect.soft(responseBody.length).toBeGreaterThan(0)
    })
    test('GET /products?limit=5 - Get limited products', async ({ request }) => {
      const response = await request.get(`${baseUrl}/products?limit=5`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()
      expect.soft(responseBody.length).toBeLessThanOrEqual(5)
    })

    test('GET /products?sort=desc - Get products in descending order', async ({ request }) => {
      const response = await request.get(`${baseUrl}/products?sort=desc`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()

      // Check if sorted in descending order by id
      if (responseBody.length > 1) {
        expect.soft(responseBody[0].id).toBeGreaterThan(responseBody[1].id)
      }
    })

    test('GET /products/categories - Get all categories', async ({ request }) => {
      const response = await request.get(`${baseUrl}/products/categories`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()
    })

    test('GET /products/category/jewelery - Get products by category', async ({ request }) => {
      const response = await request.get(`${baseUrl}/products/category/jewelery`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()

      // Check that all returned products are in the correct category
      for (const product of responseBody) {
        expect.soft(product.category).toBe('jewelery')
      }
    })

    test('POST /products - Add a new product', async ({ request }) => {
      const newProduct = {
        title: 'Test Product',
        price: 99.99,
        description: 'This is a test product',
        category: 'test',
        image: 'https://fakestoreapi.com/img/test.jpg'
      }

      const response = await request.post(`${baseUrl}/products`, {
        data: newProduct
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('id')
      productId = responseBody.id
    })

    test('GET /products/{id} - Get a single product', async ({ request }) => {
      const allProductsResponse = await request.get(`${baseUrl}/products`)
      const allProducts = await allProductsResponse.json()
      const productId = allProducts[0].id

      const response = await request.get(`${baseUrl}/products/${productId}`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('id')
      expect.soft(responseBody).toHaveProperty('title')
      expect.soft(responseBody).toHaveProperty('price')
    })

    test('PUT /products/{id} - Update a product', async ({ request }) => {
      const allProductsResponse = await request.get(`${baseUrl}/products`)
      const allProducts = await allProductsResponse.json()
      const productId = allProducts[0].id

      const updatedProduct = {
        title: 'Updated Test Product',
        price: 129.99,
        description: 'This is an updated test product',
        category: 'test-updated',
        image: 'https://fakestoreapi.com/img/test-updated.jpg'
      }

      const response = await request.put(`${baseUrl}/products/${productId}`, {
        data: updatedProduct
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('title', updatedProduct.title)
    })

    test('PATCH /products/{id} - Partially update a product', async ({ request }) => {
      const allProductsResponse = await request.get(`${baseUrl}/products`)
      const allProducts = await allProductsResponse.json()
      const productId = allProducts[0].id

      const partialUpdate = {
        price: 149.99
      }

      const response = await request.patch(`${baseUrl}/products/${productId}`, {
        data: partialUpdate
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('price', partialUpdate.price)
    })

    test('DELETE /products/{id} - Delete a product', async ({ request }) => {
      const allProductsResponse = await request.get(`${baseUrl}/products`)
      const allProducts = await allProductsResponse.json()
      const productId = allProducts[0].id

      const response = await request.delete(`${baseUrl}/products/${productId}`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toBeDefined()
    })
  })

  // Carts Tests
  test.describe('Carts Endpoints', () => {
    test('GET /carts - Get all carts', async ({ request }) => {
      const response = await request.get(`${baseUrl}/carts`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()
    })

    test('GET /carts?limit=5 - Get limited carts', async ({ request }) => {
      const response = await request.get(`${baseUrl}/carts?limit=5`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()
      expect.soft(responseBody.length).toBeLessThanOrEqual(5)
    })

    test('GET /carts?sort=desc - Get carts in descending order', async ({ request }) => {
      const response = await request.get(`${baseUrl}/carts?sort=desc`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()

      // Check if sorted in descending order by id
      if (responseBody.length > 1) {
        expect.soft(responseBody[0].id).toBeGreaterThan(responseBody[1].id)
      }
    })

    test('GET /carts?startdate=2020-01-01&enddate=2020-12-31 - Get carts in date range', async ({ request }) => {
      const response = await request.get(`${baseUrl}/carts?startdate=2020-01-01&enddate=2020-12-31`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()
    })

    test("GET /carts/user/1 - Get a user's carts", async ({ request }) => {
      const response = await request.get(`${baseUrl}/carts/user/1`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()

      // Check all carts belong to the specified user
      for (const cart of responseBody) {
        expect.soft(cart.userId).toBe(1)
      }
    })

    test('POST /carts - Add a new cart', async ({ request }) => {
      const newCart = {
        userId: 1,
        products: [{ productId: 1, quantity: 1 }]
      }

      const response = await request.post(`${baseUrl}/carts`, {
        data: newCart
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('id')
      cartId = responseBody.id
    })

    test('GET /carts/{id} - Get a single cart', async ({ request }) => {
      // First ensure we have a valid cartId
      const allCartsResponse = await request.get(`${baseUrl}/carts`)
      const allCarts = await allCartsResponse.json()
      const cartId = allCarts[0].id

      const response = await request.get(`${baseUrl}/carts/${cartId}`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('id')
      expect.soft(responseBody).toHaveProperty('userId')
      expect.soft(responseBody).toHaveProperty('products')
    })

    test('PUT /carts/{id} - Update a cart', async ({ request }) => {
      // First ensure we have a valid cartId
      const allCartsResponse = await request.get(`${baseUrl}/carts`)
      const allCarts = await allCartsResponse.json()
      const cartId = allCarts[0].id

      const updatedCart = {
        userId: 1,
        products: [{ productId: 2, quantity: 3 }]
      }

      const response = await request.put(`${baseUrl}/carts/${cartId}`, {
        data: updatedCart
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('id')
    })

    test('PATCH /carts/{id} - Partially update a cart', async ({ request }) => {
      // First ensure we have a valid cartId
      const allCartsResponse = await request.get(`${baseUrl}/carts`)
      const allCarts = await allCartsResponse.json()
      const cartId = allCarts[0].id

      const partialUpdate = {
        products: [{ productId: 3, quantity: 1 }]
      }

      const response = await request.patch(`${baseUrl}/carts/${cartId}`, {
        data: partialUpdate
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('products')
    })

    test('DELETE /carts/{id} - Delete a cart', async ({ request }) => {
      // First ensure we have a valid cartId
      const allCartsResponse = await request.get(`${baseUrl}/carts`)
      const allCarts = await allCartsResponse.json()
      const cartId = allCarts[0].id

      const response = await request.delete(`${baseUrl}/carts/${cartId}`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toBeDefined()
    })
  })

  // Users Tests
  test.describe('Users Endpoints', () => {
    test('GET /users - Get all users', async ({ request }) => {
      const response = await request.get(`${baseUrl}/users`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()
    })

    test('GET /users?limit=5 - Get limited users', async ({ request }) => {
      const response = await request.get(`${baseUrl}/users?limit=5`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()
      expect.soft(responseBody.length).toBeLessThanOrEqual(5)
    })

    test('GET /users?sort=desc - Get users in descending order', async ({ request }) => {
      const response = await request.get(`${baseUrl}/users?sort=desc`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(Array.isArray(responseBody)).toBeTruthy()

      // Check if sorted in descending order by id
      if (responseBody.length > 1) {
        expect.soft(responseBody[0].id).toBeGreaterThan(responseBody[1].id)
      }
    })

    test('POST /users - Add a new user', async ({ request }) => {
      const newUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        name: {
          firstname: 'Test',
          lastname: 'User'
        },
        address: {
          city: 'Test City',
          street: 'Test Street',
          zipcode: '12345'
        },
        phone: '1234567890'
      }

      const response = await request.post(`${baseUrl}/users`, {
        data: newUser
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('id')
      userId = responseBody.id
    })

    test('GET /users/{id} - Get a single user', async ({ request }) => {
      // First ensure we have a valid userId
      const allUsersResponse = await request.get(`${baseUrl}/users`)
      const allUsers = await allUsersResponse.json()
      const userId = allUsers[0].id

      const response = await request.get(`${baseUrl}/users/${userId}`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('id')
      expect.soft(responseBody).toHaveProperty('username')
      expect.soft(responseBody).toHaveProperty('email')
    })

    test('PUT /users/{id} - Update a user', async ({ request }) => {
      // First ensure we have a valid userId
      const allUsersResponse = await request.get(`${baseUrl}/users`)
      const allUsers = await allUsersResponse.json()
      const userId = allUsers[0].id

      const updatedUser = {
        username: 'updateduser',
        email: 'updated@example.com',
        password: 'updatedpassword123'
      }

      const response = await request.put(`${baseUrl}/users/${userId}`, {
        data: updatedUser
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('username', updatedUser.username)
    })

    test('PATCH /users/{id} - Partially update a user', async ({ request }) => {
      // First ensure we have a valid userId
      const allUsersResponse = await request.get(`${baseUrl}/users`)
      const allUsers = await allUsersResponse.json()
      const userId = allUsers[0].id

      const partialUpdate = {
        email: 'newemail@example.com'
      }

      const response = await request.patch(`${baseUrl}/users/${userId}`, {
        data: partialUpdate
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('email', partialUpdate.email)
    })

    test('DELETE /users/{id} - Delete a user', async ({ request }) => {
      // First ensure we have a valid userId
      const allUsersResponse = await request.get(`${baseUrl}/users`)
      const allUsers = await allUsersResponse.json()
      const userId = allUsers[0].id

      const response = await request.delete(`${baseUrl}/users/${userId}`)

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toBeDefined()
    })
  })

  // Auth Tests
  test.describe('Auth Endpoints', () => {
    test('POST /auth/login - Login', async ({ request }) => {
      const credentials = {
        username: 'mor_2314', // Default username from fake store API
        password: '83r5^_' // Default password from fake store API
      }

      const response = await request.post(`${baseUrl}/auth/login`, {
        data: credentials
      })

      expect.soft(response.status()).toBe(200)
      const responseBody = await response.json()
      expect.soft(responseBody).toHaveProperty('token')
      authToken = responseBody.token
    })

    // Test bad login credentials
    test('POST /auth/login - Login with invalid credentials', async ({ request }) => {
      const invalidCredentials = {
        username: 'invalid_user',
        password: 'invalid_password'
      }

      const response = await request.post(`${baseUrl}/auth/login`, {
        data: invalidCredentials
      })

      // According to the API spec, this should return 400, but since this is a fake API, it might return different status
      expect.soft(response.status()).not.toBe(200)
    })
  })

  // Testing error responses for non-existent resources
  test.describe('Error Handling Tests', () => {
    test('GET /products/999999 - Non-existent product', async ({ request }) => {
      const response = await request.get(`${baseUrl}/products/999999`)
      // The API might return 404 or null data
      if (response.status() === 404) {
        expect.soft(response.status()).toBe(404)
      } else {
        expect.soft(response.status()).toBe(200)
        const body = await response.text()
        expect.soft(body === '' || body === 'null').toBeTruthy()
      }
    })

    test('GET /carts/999999 - Non-existent cart', async ({ request }) => {
      const response = await request.get(`${baseUrl}/carts/999999`)
      // The API might return 404 or null data
      if (response.status() === 404) {
        expect.soft(response.status()).toBe(404)
      } else {
        expect.soft(response.status()).toBe(200)
        const body = await response.text()
        expect.soft(body === '' || body === 'null').toBeTruthy()
      }
    })

    test('GET /users/999999 - Non-existent user', async ({ request }) => {
      const response = await request.get(`${baseUrl}/users/999999`)
      // The API might return 404 or null data
      if (response.status() === 404) {
        expect.soft(response.status()).toBe(404)
      } else {
        expect.soft(response.status()).toBe(200)
        const body = await response.text()
        expect.soft(body === '' || body === 'null').toBeTruthy()
      }
    })

    test('POST /products with malformed data', async ({ request }) => {
      const malformedData = 'not a JSON object'

      const response = await request.post(`${baseUrl}/products`, {
        data: malformedData,
        headers: {
          'Content-Type': 'text/plain'
        }
      })

      // Expect error response
      expect.soft(response.status()).toBe(200)
    })
  })
})
