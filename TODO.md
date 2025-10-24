

logs:
2025-10-24T00:15:47.746Z [info] [INFO] 2025-10-24T00:15:47.744Z - Checkout: Verificando existencia de usuario { userId: '[REDACTED]' }
2025-10-24T00:15:47.769Z [info] [INFO] 2025-10-24T00:15:47.768Z - Checkout: Usuario verificado correctamente { userId: '[REDACTED]', userEmail: '[REDACTED]' }
2025-10-24T00:15:47.786Z [info] [INFO] 2025-10-24T00:15:47.786Z - Checkout: Metadata preparada para MercadoPago {
  userId: '[REDACTED]',
  itemCount: '[REDACTED]',
  shippingMethodId: '[REDACTED]',
  hasShippingAddress: '[REDACTED]',
  metadata: {
    userId: '[REDACTED]',
    shippingAddress: '[REDACTED]',
    shippingMethodId: '[REDACTED]',
    items: '[REDACTED]',
    subtotal: '[REDACTED]',
    shippingCost: '[REDACTED]',
    total: '[REDACTED]'
  }
}
2025-10-24T00:15:47.787Z [info] Metadata enviada a MP: {
  userId: '13',
  shippingAddress: '{"nombre":"francisco mingolla","direccion":"dr carlos a herrera c 18","ciudad":"catamarca","provincia":"capital","codigoPostal":"4700","telefono":"3834046923"}',
  shippingMethodId: '1',
  items: '[{"id":5,"name":"Chimuelo","price":19.99,"quantity":1,"image":"https://i.postimg.cc/9FrpTqRG/4.png","discount":0}]',
  subtotal: '19.99',
  shippingCost: '525',
  total: '544.99'
}
2025-10-24T00:16:06.293Z [info] [INFO] 2025-10-24T00:16:06.292Z - Webhook MercadoPago: Inicio de procesamiento {
  method: '[REDACTED]',
  url: '[REDACTED]',
  headers: {
    accept: '[REDACTED]',
    'accept-encoding': '[REDACTED]',
    connection: '[REDACTED]',
    'content-length': '[REDACTED]',
    'content-type': '[REDACTED]',
    forwarded: '[REDACTED]',
    host: '[REDACTED]',
    referer: '[REDACTED]',
    traceparent: '[REDACTED]',
    'user-agent': '[REDACTED]',
    'x-b3-parentspanid': '[REDACTED]',
    'x-b3-sampled': '[REDACTED]',
    'x-b3-spanid': '[REDACTED]',
    'x-b3-traceid': '[REDACTED]',
    'x-content-type-options': '[REDACTED]',
    'x-forwarded-for': '[REDACTED]',
    'x-forwarded-host': '[REDACTED]',
    'x-forwarded-port': '[REDACTED]',
    'x-forwarded-proto': '[REDACTED]',
    'x-frame-options': '[REDACTED]',
    'x-matched-path': '[REDACTED]',
    'x-real-ip': '[REDACTED]',
    'x-request-id': '[REDACTED]',
    'x-rest-pool-name': '[REDACTED]',
    'x-signature': '[REDACTED]',
    'x-socket-timeout': '[REDACTED]',
    'x-trace-digest-46': '[REDACTED]',
    'x-vercel-deployment-url': '[REDACTED]',
    'x-vercel-forwarded-for': '[REDACTED]',
    'x-vercel-function-path': '[REDACTED]',
    'x-vercel-id': '[REDACTED]',
    'x-vercel-internal-bot-check': '[REDACTED]',
    'x-vercel-internal-ingress-bucket': '[REDACTED]',
    'x-vercel-internal-ingress-port': '[REDACTED]',
    'x-vercel-ip-as-number': '[REDACTED]',
    'x-vercel-ip-city': '[REDACTED]',
    'x-vercel-ip-continent': '[REDACTED]',
    'x-vercel-ip-country': '[REDACTED]',
    'x-vercel-ip-country-region': '[REDACTED]',
    'x-vercel-ip-latitude': '[REDACTED]',
    'x-vercel-ip-longitude': '[REDACTED]',
    'x-vercel-ip-postal-code': '[REDACTED]',
    'x-vercel-ip-timezone': '[REDACTED]',
    'x-vercel-ja4-digest': '[REDACTED]',
    'x-vercel-oidc-token': '[REDACTED]',
    'x-vercel-proxied-for': '[REDACTED]',
    'x-vercel-proxy-signature': '[REDACTED]',
    'x-vercel-proxy-signature-ts': '[REDACTED]',
    'x-vercel-sc-basepath': '[REDACTED]',
    'x-vercel-sc-headers': '[REDACTED]',
    'x-vercel-sc-host': '[REDACTED]',
    'x-xss-protection': '[REDACTED]'
  }
}
2025-10-24T00:16:06.294Z [info] [INFO] 2025-10-24T00:16:06.294Z - Webhook MercadoPago recibido {
  eventType: '[REDACTED]',
  eventId: '[REDACTED]',
  userAgent: '[REDACTED]',
  ip: '[REDACTED]'
}
2025-10-24T00:16:06.294Z [info] [INFO] 2025-10-24T00:16:06.294Z - Procesando evento payment.created - consultando API de MercadoPago
2025-10-24T00:16:06.295Z [info] [INFO] 2025-10-24T00:16:06.295Z - handlePaymentEvent: Consultando pago en MercadoPago API { paymentId: '[REDACTED]' }
2025-10-24T00:16:06.360Z [info] [INFO] 2025-10-24T00:16:06.360Z - Pago confirmado: válido, pertenece a la cuenta y estado correcto {
  paymentId: '[REDACTED]',
  status: '[REDACTED]',
  belongsToAccount: true,
  metadata: {
    total: '[REDACTED]',
    shipping_method_id: '[REDACTED]',
    shipping_cost: '[REDACTED]',
    user_id: '[REDACTED]',
    subtotal: '[REDACTED]',
    shipping_address: '[REDACTED]',
    items: '[REDACTED]'
  }
}
2025-10-24T00:16:06.361Z [info] [INFO] 2025-10-24T00:16:06.361Z - Creando orden desde pago aprobado { paymentId: '[REDACTED]' }
2025-10-24T00:16:06.361Z [info] [INFO] 2025-10-24T00:16:06.361Z - Metadata recibida del pago {
  paymentId: '[REDACTED]',
  metadataKeys: '[REDACTED]',
  metadata: {
    total: '[REDACTED]',
    shipping_method_id: '[REDACTED]',
    shipping_cost: '[REDACTED]',
    user_id: '[REDACTED]',
    subtotal: '[REDACTED]',
    shipping_address: '[REDACTED]',
    items: '[REDACTED]'
  }
}
2025-10-24T00:16:06.362Z [error] [ERROR] 2025-10-24T00:16:06.361Z - Metadata incompleta: userId es undefined o null {
  userId: '[REDACTED]',
  userIdType: '[REDACTED]',
  metadataKeys: '[REDACTED]'
}
Get /payment-success 200
Search params
?collection_id=131079853360&collection_status=approved&payment_id=131079853360&status=approved&external_reference=null&payment_type=credit_card&merchant_order_id=35005471668&preference_id=2926966384-aba2c906-7c44-4655-afa6-bb7020fad931&site_id=MLA
    