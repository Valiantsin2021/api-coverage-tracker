import { expect, test } from '@playwright/test'
import { ApiCoverage } from 'api-coverage-tracker'
import config from '../config.json' with { type: 'json' }
const apiCoverage = new ApiCoverage(config)
await apiCoverage.loadSpec('https://raw.githubusercontent.com/ServeRest/ServeRest/trunk/docs/swagger.json')
apiCoverage.setDebug(false)
// Base configuration
const BASE_URL = 'https://serverest.dev'

// Test data
const testUser = {
  nome: 'Test User',
  email: `test${Date.now()}@qa.com`,
  password: 'teste123',
  administrador: 'true'
}

const testProduct = {
  nome: `Test Product ${Date.now()}`,
  preco: 100,
  descricao: 'Test product description',
  quantidade: 50
}

let authToken = ''
let userId = ''
let productId = ''
let cartId = ''
test.beforeEach(async ({ request }) => {
  apiCoverage.startTracking(request, { clientType: 'playwright', coverage: 'detailed' })
})

test.afterEach(async ({ request }) => {
  apiCoverage.stopTracking(request)
})
test.afterAll(async () => {
  await apiCoverage.generateReport()
})
test.describe.configure({ mode: 'serial' })

test.describe('ServeRest API Tests', () => {
  test.describe('Login Tests', () => {
    test('POST /usuarios - create user successfully', async ({ request }) => {
      const newUser = {
        nome: 'New Test User',
        email: `newuser${Date.now()}@qa.com`,
        password: 'teste123',
        administrador: 'false'
      }

      const response = await request.post(`${BASE_URL}/usuarios`, {
        data: newUser
      })

      expect.soft(response.status()).toBe(201)
      const data = await response.json()
      expect.soft(data.message).toBe('Cadastro realizado com sucesso')
      expect.soft(data._id).toBeDefined()

      userId = data._id
    })
    test('POST /login - successful login', async ({ request }) => {
      // First create a user
      const createUserResponse = await request.post(`${BASE_URL}/usuarios`, {
        data: testUser
      })
      expect.soft(createUserResponse.status()).toBe(201)

      // Then attempt login
      const loginResponse = await request.post(`${BASE_URL}/login`, {
        data: {
          email: testUser.email,
          password: testUser.password
        }
      })

      expect.soft(loginResponse.status()).toBe(200)
      const loginData = await loginResponse.json()
      expect.soft(loginData.message).toBe('Login realizado com sucesso')
      expect.soft(loginData.authorization).toContain('Bearer')

      // Store token for other tests
      authToken = loginData.authorization
    })

    test('POST /login - invalid credentials', async ({ request }) => {
      const loginResponse = await request.post(`${BASE_URL}/login`, {
        data: {
          email: 'invalid@email.com',
          password: 'wrongpassword'
        }
      })

      expect.soft(loginResponse.status()).toBe(401)
      const loginData = await loginResponse.json()
      expect.soft(loginData.message).toBe('Email e/ou senha inválidos')
    })
  })

  test.describe('Users Tests', () => {
    test('GET /usuarios - list all users', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/usuarios`)
      expect.soft(response.status()).toBe(200)

      const data = await response.json()
      expect.soft(data).toHaveProperty('quantidade')
      expect.soft(data).toHaveProperty('usuarios')
      expect.soft(Array.isArray(data.usuarios)).toBe(true)
    })

    test('POST /usuarios - duplicate email error', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/usuarios`, {
        data: testUser // Using same email as before
      })

      expect.soft(response.status()).toBe(400)
      const data = await response.json()
      expect.soft(data.message).toBe('Este email já está sendo usado')
    })

    test('GET /usuarios/{id} - get user by ID', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/usuarios/${userId}`)
      expect.soft(response.status()).toBe(200)

      const data = await response.json()
      expect.soft(data).toHaveProperty('nome')
      expect.soft(data).toHaveProperty('email')
      expect.soft(data).toHaveProperty('_id')
      expect.soft(data._id).toBe(userId)
    })

    test('GET /usuarios/{id} - user not found', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/usuarios/invalidid123`)
      expect.soft(response.status()).toBe(400)

      const data = await response.json()
      expect.soft(data.id).toBe('id deve ter exatamente 16 caracteres alfanuméricos')
    })

    test('PUT /usuarios/{id} - update user', async ({ request }) => {
      const updatedUser = {
        nome: 'Updated Test User',
        email: `updated${Date.now()}@qa.com`,
        password: 'newpassword',
        administrador: 'true'
      }

      const response = await request.put(`${BASE_URL}/usuarios/${userId}`, {
        data: updatedUser
      })

      expect.soft(response.status()).toBe(200)
      const data = await response.json()
      expect.soft(data.message).toBe('Registro alterado com sucesso')
    })

    test('DELETE /usuarios/{id} - delete user', async ({ request }) => {
      const response = await request.delete(`${BASE_URL}/usuarios/${userId}`)
      expect.soft(response.status()).toBe(200)

      const data = await response.json()
      expect.soft(data.message).toMatch(/Registro excluído com sucesso|Nenhum registro excluído/)
    })
  })

  test.describe('Products Tests', () => {
    test.beforeAll(async ({ request }) => {
      // Ensure we have auth token
      if (!authToken) {
        const loginResponse = await request.post(`${BASE_URL}/login`, {
          data: {
            email: testUser.email,
            password: testUser.password
          }
        })
        const loginData = await loginResponse.json()
        authToken = loginData.authorization
      }
    })

    test('GET /produtos - list all products', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/produtos`)
      expect.soft(response.status()).toBe(200)

      const data = await response.json()
      expect.soft(data).toHaveProperty('quantidade')
      expect.soft(data).toHaveProperty('produtos')
      expect.soft(Array.isArray(data.produtos)).toBe(true)
    })

    test('POST /produtos - create product successfully', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/produtos`, {
        headers: {
          Authorization: authToken
        },
        data: testProduct
      })

      expect.soft(response.status()).toBe(201)
      const data = await response.json()
      expect.soft(data.message).toBe('Cadastro realizado com sucesso')
      expect.soft(data._id).toBeDefined()

      productId = data._id
    })

    test('POST /produtos - unauthorized (no token)', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/produtos`, {
        data: testProduct
      })

      expect.soft(response.status()).toBe(401)
      const data = await response.json()
      expect.soft(data.message).toBe('Token de acesso ausente, inválido, expirado ou usuário do token não existe mais')
    })

    test('POST /produtos - duplicate product name', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/produtos`, {
        headers: {
          Authorization: authToken
        },
        data: testProduct // Same name as before
      })

      expect.soft(response.status()).toBe(400)
      const data = await response.json()
      expect.soft(data.message).toBe('Já existe produto com esse nome')
    })

    test('GET /produtos/{id} - get product by ID', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/produtos/${productId}`)
      expect.soft(response.status()).toBe(200)

      const data = await response.json()
      expect.soft(data).toHaveProperty('nome')
      expect.soft(data).toHaveProperty('preco')
      expect.soft(data).toHaveProperty('descricao')
      expect.soft(data).toHaveProperty('quantidade')
      expect.soft(data._id).toBe(productId)
    })

    test('GET /produtos/{id} - product not found', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/produtos/invalidid123`)
      expect.soft(response.status()).toBe(400)

      const data = await response.json()
      expect.soft(data.id).toBe('id' + ' deve ter exatamente 16 caracteres alfanuméricos')
    })

    test('PUT /produtos/{id} - update product', async ({ request }) => {
      const updatedProduct = {
        nome: `Updated Product ${Date.now()}`,
        preco: 150,
        descricao: 'Updated description',
        quantidade: 75
      }

      const response = await request.put(`${BASE_URL}/produtos/${productId}`, {
        headers: {
          Authorization: authToken
        },
        data: updatedProduct
      })

      expect.soft(response.status()).toBe(200)
      const data = await response.json()
      expect.soft(data.message).toBe('Registro alterado com sucesso')
    })
  })

  test.describe('Shopping Cart Tests', () => {
    test('GET /carrinhos - list all carts', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/carrinhos`)
      expect.soft(response.status()).toBe(200)

      const data = await response.json()
      expect.soft(data).toHaveProperty('quantidade')
      expect.soft(data).toHaveProperty('carrinhos')
      expect.soft(Array.isArray(data.carrinhos)).toBe(true)
    })

    test('POST /carrinhos - create cart successfully', async ({ request }) => {
      const cartData = {
        produtos: [
          {
            idProduto: productId,
            quantidade: 2
          }
        ]
      }

      const response = await request.post(`${BASE_URL}/carrinhos`, {
        headers: {
          Authorization: authToken
        },
        data: cartData
      })

      expect.soft(response.status()).toBe(201)
      const data = await response.json()
      expect.soft(data.message).toBe('Cadastro realizado com sucesso')
      expect.soft(data._id).toBeDefined()

      cartId = data._id
    })

    test('POST /carrinhos - unauthorized (no token)', async ({ request }) => {
      const cartData = {
        produtos: [
          {
            idProduto: productId,
            quantidade: 1
          }
        ]
      }

      const response = await request.post(`${BASE_URL}/carrinhos`, {
        data: cartData
      })

      expect.soft(response.status()).toBe(401)
      const data = await response.json()
      expect.soft(data.message).toBe('Token de acesso ausente, inválido, expirado ou usuário do token não existe mais')
    })

    test('GET /carrinhos/{id} - get cart by ID', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/carrinhos/${cartId}`)
      expect.soft(response.status()).toBe(200)

      const data = await response.json()
      expect.soft(data).toHaveProperty('produtos')
      expect.soft(data).toHaveProperty('precoTotal')
      expect.soft(data).toHaveProperty('quantidadeTotal')
      expect.soft(data).toHaveProperty('idUsuario')
      expect.soft(data._id).toBe(cartId)
    })

    test('GET /carrinhos/{id} - cart not found', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/carrinhos/invalidid123`)
      expect.soft(response.status()).toBe(400)

      const data = await response.json()
      expect.soft(data.id).toBe('id deve ter exatamente 16 caracteres alfanuméricos')
    })

    test('DELETE /carrinhos/cancelar-compra - cancel purchase', async ({ request }) => {
      const response = await request.delete(`${BASE_URL}/carrinhos/cancelar-compra`, {
        headers: {
          Authorization: authToken
        }
      })

      expect.soft(response.status()).toBe(200)
      const data = await response.json()
      expect.soft(data.message).toMatch(/Registro excluído com sucesso|Não foi encontrado carrinho para esse usuário/)
    })

    test('DELETE /carrinhos/concluir-compra - complete purchase', async ({ request }) => {
      // First create a new cart
      const cartData = {
        produtos: [
          {
            idProduto: productId,
            quantidade: 1
          }
        ]
      }

      await request.post(`${BASE_URL}/carrinhos`, {
        headers: {
          Authorization: authToken
        },
        data: cartData
      })

      // Then complete the purchase
      const response = await request.delete(`${BASE_URL}/carrinhos/concluir-compra`, {
        headers: {
          Authorization: authToken
        }
      })

      expect.soft(response.status()).toBe(200)
      const data = await response.json()
      expect.soft(data.message).toMatch(/Registro excluído com sucesso|Não foi encontrado carrinho para esse usuário/)
    })
  })

  test.describe('Query Parameter Tests', () => {
    test('GET /usuarios with query parameters', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/usuarios?administrador=true`)
      expect.soft(response.status()).toBe(200)

      const data = await response.json()
      expect.soft(data).toHaveProperty('usuarios')

      // All returned users should be administrators
      if (data.usuarios.length > 0) {
        data.usuarios.forEach(user => {
          expect.soft(user.administrador).toBe('true')
        })
      }
    })

    test('GET /produtos with query parameters', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/produtos?preco=100`)
      expect.soft(response.status()).toBe(200)

      const data = await response.json()
      expect.soft(data).toHaveProperty('produtos')

      // All returned products should have price = 100
      if (data.produtos.length > 0) {
        data.produtos.forEach(product => {
          expect.soft(product.preco).toBe(100)
        })
      }
    })
  })

  test.describe('Error Handling Tests', () => {
    test('Invalid JSON in request body', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/usuarios`, {
        data: '{"invalid": json}',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      expect.soft(response.status()).toBe(400)
    })

    test('Missing required fields', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/usuarios`, {
        data: {
          nome: 'Test User'
          // Missing email, password, administrador
        }
      })

      expect.soft(response.status()).toBe(400)
    })

    test('Invalid token format', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/produtos`, {
        headers: {
          Authorization: 'InvalidToken'
        },
        data: testProduct
      })

      expect.soft(response.status()).toBe(401)
    })
  })

  test.describe('Data Validation Tests', () => {
    test('User email format validation', async ({ request }) => {
      const invalidUser = {
        nome: 'Test User',
        email: 'invalid-email',
        password: 'teste123',
        administrador: 'true'
      }

      const response = await request.post(`${BASE_URL}/usuarios`, {
        data: invalidUser
      })

      expect.soft(response.status()).toBe(400)
    })

    test('Product price validation', async ({ request }) => {
      const invalidProduct = {
        nome: `Invalid Product ${Date.now()}`,
        preco: -10, // Negative price should be invalid
        descricao: 'Test description',
        quantidade: 50
      }

      const response = await request.post(`${BASE_URL}/produtos`, {
        headers: {
          Authorization: authToken
        },
        data: invalidProduct
      })

      expect.soft(response.status()).toBe(400)
    })
  })

  test.describe('Cleanup', () => {
    test('DELETE /produtos/{id} - cleanup test product', async ({ request }) => {
      if (productId) {
        const response = await request.delete(`${BASE_URL}/produtos/${productId}`, {
          headers: {
            Authorization: authToken
          }
        })

        expect.soft([200, 400]).toContain(response.status())
      }
    })
  })
})
