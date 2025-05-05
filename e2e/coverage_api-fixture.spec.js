import { expect, test } from '@fixtures/fixture.js'

const testData = {
  username: 'john',
  password: 'demo',
  accountId: 12345,
  newAccountId: 12346,
  toAccountId: 12456,
  customerId: 12212,
  transactionId: 1,
  product: ['shoes', 'clothes'][Math.floor(Math.random() * 2)],
  randomAccount: Math.floor(Math.random() * 10000000),
  randomAmount: Math.floor(Math.random() * 100) + '.00',
  transactionType: ['Credit', 'Debit'][Math.floor(Math.random() * 2)],
  month: Math.floor(Math.random() * 12) + 1,
  fromDate: '2023-01-01',
  toDate: '2023-12-31',
  firstname: 'John',
  lastname: 'Doe',
  street: '123 Main St',
  city: 'Anytown',
  state: 'CA',
  country: 'USA',
  countryCode: '12345',
  phoneNumber: '123-456-7890',
  ssn: '123-45-6789',
  newUserName: 'JD',
  newPassword: 'password123'
}

test.describe.configure({ mode: 'default' })
test.use({
  baseURL: 'https://parabank.parasoft.com/parabank/services/bank/',
  extraHTTPHeaders: { 'Content-Type': 'application/json', Accept: 'application/json' }
})
test.describe('API Coverage Tests', () => {
  test('POST Stop JMS Listener /shutdownJmsListener', async ({ request }) => {
    const response = await request.post('shutdownJmsListener')
    expect.soft(response.status()).toBe(204)
  })
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
    const response = await request.post(`setParameter/${testData.product}/${testData.randomAccount}`)
    expect.soft(response.status()).toBe(204)
  })

  // login

  test('GET /login/:username/:password', async ({ request }) => {
    const response = await request.get(`login/${testData.username}/${testData.password}`)
    const body = await response.json()

    await expect.soft(response).toBeOK()
    expect.soft(body).toMatchObject({
      id: expect.any(Number),
      firstName: 'John',
      lastName: 'Smith',
      address: {
        street: expect.any(String),
        city: expect.any(String),
        state: expect.any(String),
        zipCode: expect.any(String)
      },
      phoneNumber: expect.any(String),
      ssn: expect.any(String)
    })
  })

  // accounts
  test('GET /customers/:customerId/accounts', async ({ request }) => {
    const response = await request.get(`customers/${testData.customerId}/accounts`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(1)
    body.forEach(account => {
      expect.soft(account).toMatchObject({
        id: expect.any(Number),
        customerId: expect.any(Number),
        balance: expect.any(Number)
      })
    })
  })
  test('GET /accounts/:accountId', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toMatchObject({
      id: expect.any(Number),
      customerId: expect.any(Number),
      balance: expect.any(Number)
    })
  })
  test('GET /accounts/:transactions', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(1)
    body.forEach(transaction => {
      expect.soft(transaction).toMatchObject({
        id: expect.any(Number),
        accountId: expect.any(Number),
        type: expect.any(String),
        date: expect.any(Number),
        amount: expect.any(Number),
        description: expect.any(String)
      })
    })
  })
  test('GET /accounts/:transactions/amount/{amount}', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions/amount/${testData.randomAmount}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBe(0)
  })
  test('GET /accounts/{accountId}/transactions/month/{month}/type/{type}', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions/month/${testData.month}/type/${testData.transactionType}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(0)
    body.forEach(transaction => {
      expect.soft(transaction).toMatchObject({
        id: expect.any(Number),
        accountId: expect.any(Number),
        type: expect.any(String),
        date: expect.any(Number),
        amount: expect.any(Number),
        description: expect.any(String)
      })
    })
  })
  test('GET /accounts/{accountId}/transactions/fromDate/{fromDate}/toDate/{toDate}', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions/fromDate/${testData.fromDate}/toDate/${testData.toDate}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBe(0)
  })
  test('GET /accounts/{accountId}/transactions/onDate/{onDate}', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions/onDate/${testData.fromDate}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBe(0)
  })
  test('POST Deposit funds /deposit?accountId={{accountId}}&amount={{$randomPrice}}', async ({ request }) => {
    const response = await request.post(`deposit?accountId=${testData.accountId}&amount=${testData.randomAmount}`)
    await expect.soft(response).toBeOK()
    const body = await response.text()
    expect.soft(body).toMatch(`Successfully deposited $${testData.randomAmount} to account #${testData.accountId}`)
  })
  test('POST Transfer funds /transfer?fromAccountId={{accountId}}&toAccountId={{toAccountId}}&amount={{$randomPrice}}', async ({ request }) => {
    const response = await request.post(
      `transfer?fromAccountId=${testData.accountId}&toAccountId=${testData.toAccountId}&amount=${testData.randomAmount}`
    )
    await expect.soft(response).toBeOK()
    const body = await response.text()
    expect
      .soft(body)
      .toMatch(`Successfully transferred $${testData.randomAmount} from account #${testData.accountId} to account #${testData.toAccountId}`)
  })
  test('POST Withdraw funds /withdraw?accountId={{accountId}}&amount={{$randomPrice}}', async ({ request }) => {
    const response = await request.post(`withdraw?accountId=${testData.accountId}&amount=${testData.randomAmount}`)
    await expect.soft(response).toBeOK()
    const body = await response.text()
    expect.soft(body).toMatch(`Successfully withdrew $${testData.randomAmount} from account #${testData.accountId}`)
  })
  test('GET /accounts/:accountId/transactions', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(1)
    body.forEach(transaction => {
      expect.soft(transaction).toMatchObject({
        id: expect.any(Number),
        accountId: expect.any(Number),
        type: expect.any(String),
        date: expect.any(Number),
        amount: expect.any(Number),
        description: expect.any(String)
      })
    })
  })
  test('POST Pay bills /billpay?accountId={{accountId}}&amount={{$randomPrice}}', async ({ request }) => {
    const response = await request.post(`billpay?accountId=${testData.accountId}&amount=${testData.randomAmount}`)
    expect.soft(response.status()).toBe(500) // bug in app
  })
  test('POST Request a loan /requestLoan?customerId={{customerId}}&amount={{$randomPrice}}&downPayment={{$randomPrice}}&fromAccountId={{accountId}}', async ({
    request
  }) => {
    const response = await request.post(
      `requestLoan?customerId=${testData.customerId}&amount=${testData.randomAmount}&downPayment=${testData.randomAmount}&fromAccountId=${testData.accountId}`
    )
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toMatchObject({
      responseDate: expect.any(Number),
      loanProviderName: expect.any(String),
      approved: expect.any(Boolean),
      accountId: expect.any(Number)
    })
  })
  test('POST Create a new account /createAccount?customerId={{customerId}}&newAccountType=0&fromAccountId={{accountId}}', async ({ request }) => {
    const response = await request.post(`createAccount?customerId=${testData.customerId}&newAccountType=0&fromAccountId=${testData.accountId}`)
    testData.newAccountId = (await response.json()).id
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toMatchObject({
      id: expect.any(Number),
      customerId: expect.any(Number),
      balance: expect.any(Number),
      type: 'CHECKING'
    })
  })

  // transactions

  test('GET Get the list of Transactions for the account /accounts/:accountId/transactions', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions`)
    testData.transactionId = (await response.json())[0].id
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(1)
    body.forEach(transaction => {
      expect.soft(transaction).toMatchObject({
        id: expect.any(Number),
        accountId: expect.any(Number),
        type: expect.any(String),
        date: expect.any(Number),
        amount: expect.any(Number),
        description: expect.any(String)
      })
    })
  })

  test('GET Create transactions by amount for account /accounts/:accountId/transactions/amount/:amount', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions?amount=${testData.randomAmount}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(0)
    body.forEach(transaction => {
      expect.soft(transaction).toMatchObject({
        id: expect.any(Number),
        accountId: expect.any(Number),
        type: expect.any(String),
        date: expect.any(Number),
        amount: expect.any(Number),
        description: expect.any(String)
      })
    })
  })
  test('GET Fetch transactions by month and type for account /accounts/:accountId/transactions/month/:month/type/:type', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions?month=${testData.month}&type=${testData.transactionType}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(0)
    body.forEach(transaction => {
      expect.soft(transaction).toMatchObject({
        id: expect.any(Number),
        accountId: expect.any(Number),
        type: expect.any(String),
        date: expect.any(Number),
        amount: expect.any(Number),
        description: expect.any(String)
      })
    })
  })
  test('GET Fetch transactions for date range for account /accounts/:accountId/transactions/fromDate/:fromDate/toDate/:toDate', async ({
    request
  }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions?fromDate=${testData.fromDate}&toDate=${testData.toDate}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(0)
    body.forEach(transaction => {
      expect.soft(transaction).toMatchObject({
        id: expect.any(Number),
        accountId: expect.any(Number),
        type: expect.any(String),
        date: expect.any(Number),
        amount: expect.any(Number),
        description: expect.any(String)
      })
    })
  })
  test('GET Fetch transactions for a specific date for account /accounts/:accountId/transactions/onDate/:onDate', async ({ request }) => {
    const response = await request.get(`accounts/${testData.accountId}/transactions?onDate=${testData.fromDate}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(0)
    body.forEach(transaction => {
      expect.soft(transaction).toMatchObject({
        id: expect.any(Number),
        accountId: expect.any(Number),
        type: expect.any(String),
        date: expect.any(Number),
        amount: expect.any(Number),
        description: expect.any(String)
      })
    })
  })
  test('GET Get the transaction for the id /transactions/:transactionId', async ({ request }) => {
    const response = await request.get(`transactions/${testData.transactionId}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toMatchObject({
      id: expect.any(Number),
      accountId: expect.any(Number),
      type: expect.any(String),
      date: expect.any(Number),
      amount: expect.any(Number),
      description: expect.any(String)
    })
  })

  // customers
  test('GET Get Customer Details /customers/:customerId', async ({ request }) => {
    const response = await request.get(`customers/${testData.customerId}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toMatchObject({
      id: expect.any(Number),
      firstName: expect.any(String),
      lastName: expect.any(String),
      address: {
        street: expect.any(String),
        city: expect.any(String),
        state: expect.any(String),
        zipCode: expect.any(String)
      },
      phoneNumber: expect.any(String),
      ssn: expect.any(String)
    })
  })
  test('POST Update customer information /customers/update/:customerId?firstName={{$randomFirstName}}&lastName={{$randomLastName}}&street={{$randomStreetName}}&city={{$randomCity}}&state={{$randomCountry}}&zipCode={{$randomCountryCode}}&phoneNumber={{$randomPhoneNumber}}&ssn={{$randomPhoneNumber}}&username={{$randomAbbreviation}}&password={{$randomAlphaNumeric}}', async ({
    request
  }) => {
    const response = await request.post(
      `customers/update/${testData.customerId}?firstName=${testData.firstname}&lastName=${testData.lastname}&street=${testData.street}&city=${testData.city}&state=${testData.state}&zipCode=${testData.countryCode}&phoneNumber=${testData.phoneNumber}&ssn=${testData.ssn}&username=${testData.newUserName}&password=${testData.newPassword}`
    )
    await expect.soft(response).toBeOK()
    const body = await response.text()
    expect.soft(body).toMatch(`Successfully updated customer profile`)
  })

  // positions

  test('GET Get Positions for Customer /customers/:customerId/positions', async ({ request }) => {
    const response = await request.get(`customers/${testData.customerId}/positions`)
    testData.positionId = (await response.json())[0].positionId
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(1)
    body.forEach(position => {
      expect.soft(position).toMatchObject({
        positionId: expect.any(Number),
        customerId: expect.any(Number),
        name: expect.any(String),
        symbol: expect.any(String),
        shares: expect.any(Number),
        purchasePrice: expect.any(Number)
      })
    })
  })
  test('GET Get Position by id /positions/:positionId', async ({ request }) => {
    const response = await request.get(`positions/${testData.positionId}`)
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toMatchObject({
      positionId: expect.any(Number),
      customerId: expect.any(Number),
      name: expect.any(String),
      symbol: expect.any(String),
      shares: expect.any(Number),
      purchasePrice: expect.any(Number)
    })
  })
  test('GET Get Position history by id within a date range /positions/:positionId/:startDate/:endDate', async ({ request }) => {
    const response = await request.get(`positions/${testData.positionId}/${testData.fromDate}/${testData.toDate}`)
    expect.soft(response.status()).toBe(400)
    expect.soft(await response.text()).toBe(`Could not find position #${testData.positionId}`)
  })
  test('POST Buy a Position /customers/:customerId/buyPosition?accountId={{accountId}}&name={{$randomCompanyName}}&symbol={{$randomAbbreviation}}&shares=${randomAmount}&pricePerShare=5.99', async ({
    request
  }) => {
    const response = await request.post(
      `customers/${testData.customerId}/buyPosition?accountId=${testData.accountId}&name=${testData.product}&symbol=${testData.product}&shares=${testData.month}&pricePerShare=${testData.randomAmount}`
    )
    testData.positionId = (await response.json()).id
    await expect.soft(response).toBeOK()
    const body = await response.json()
    expect.soft(body).toBeInstanceOf(Array)
    expect.soft(body.length).toBeGreaterThan(1)
    body.forEach(position => {
      expect.soft(position).toMatchObject({
        positionId: expect.any(Number),
        customerId: expect.any(Number),
        name: expect.any(String),
        symbol: expect.any(String),
        shares: expect.any(Number),
        purchasePrice: expect.any(Number)
      })
    })
  })
  test('POST Sell a Position /customers/:customerId/sellPosition?accountId={{accountId}}&positionId={{positionId}}&shares={{sharesCount}}&pricePerShare={{$randomPrice}}', async ({
    request
  }) => {
    const response = await request.post(
      `customers/${testData.customerId}/sellPosition?accountId=${testData.accountId}&positionId=${testData.positionId}&shares=${testData.month}&pricePerShare=${testData.randomAmount}`
    )
    expect.soft(response.status()).toBe(404)
    expect.soft(await response.text()).toBe(``)
  })
})
