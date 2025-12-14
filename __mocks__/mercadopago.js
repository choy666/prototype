const mockPaymentsFind = jest.fn();
const mockMerchantOrdersGet = jest.fn();

module.exports = {
  mockPaymentsFind,
  mockMerchantOrdersGet,
  MercadoPagoConfig: jest.fn(),
  Payment: jest.fn(),
  payments: {
    find: mockPaymentsFind
  },
  merchant_orders: {
    get: mockMerchantOrdersGet
  }
};
