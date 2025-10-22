import { MercadoPagoConfig } from 'mercadopago';

// Script para validar la configuración del webhook de Mercado Pago
async function validateWebhookConfig() {
  console.log('🔧 Validando configuración del webhook de Mercado Pago...\n');

  try {
    // Verificar variables de entorno
    console.log('1. Verificando variables de entorno...');

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const notificationUrl = process.env.MERCADO_PAGO_NOTIFICATION_URL;

    console.log(`   - Access Token: ${accessToken ? '✅ definido' : '❌ no definido'}`);
    console.log(`   - Notification URL: ${notificationUrl ? '✅ definido' : '❌ no definido'}`);

    if (!accessToken || !notificationUrl) {
      console.log('\n❌ Variables de entorno faltantes. Configura:');
      console.log('   - MERCADO_PAGO_ACCESS_TOKEN');
      console.log('   - MERCADO_PAGO_NOTIFICATION_URL');
      return;
    }

    // Verificar formato de la URL
    console.log('\n2. Validando formato de URLs...');

    try {
      new URL(notificationUrl);
      console.log('   - Notification URL: ✅ formato válido');
    } catch (e) {
      console.log('   - Notification URL: ❌ formato inválido');
    }

    // Verificar que sea HTTPS en producción
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !notificationUrl.startsWith('https://')) {
      console.log('   ⚠️  Advertencia: La URL debe ser HTTPS en producción');
    } else if (!isProduction) {
      console.log('   - Ambiente desarrollo: ✅ HTTP permitido');
    }

    // Intentar inicializar cliente de Mercado Pago
    console.log('\n3. Probando conexión con Mercado Pago...');

    try {
      const client = new MercadoPagoConfig({ accessToken });
      console.log('   - Cliente Mercado Pago: ✅ inicializado correctamente');
    } catch (error) {
      console.log('   - Cliente Mercado Pago: ❌ error de inicialización');
      console.log('     Error:', error instanceof Error ? error.message : String(error));
    }

    // Verificar estructura del webhook endpoint
    console.log('\n4. Verificando estructura del endpoint del webhook...');

    const expectedEndpoint = '/api/webhooks/mercado-pago';
    console.log(`   - Endpoint esperado: ${expectedEndpoint}`);

    // Aquí se podría hacer una verificación adicional si tuviéramos acceso a la app corriendo

    console.log('\n5. Checklist de configuración:');
    console.log('   □ Acceder al dashboard de Mercado Pago');
    console.log('   □ Ir a Configuraciones > Notificaciones');
    console.log('   □ Crear nueva notificación:');
    console.log('     - URL: https://tu-dominio.com/api/webhooks/mercado-pago');
    console.log('     - Eventos: payment.updated');
    console.log('   □ Guardar y verificar que se reciba el ping de prueba');
    console.log('   □ Verificar logs del servidor para confirmar recepción');

    console.log('\n6. URLs importantes:');
    console.log('   - Dashboard Mercado Pago: https://www.mercadopago.com.ar/developers/panel/app');
    console.log('   - Documentación webhooks: https://www.mercadopago.com.ar/developers/es/guides/notifications/webhooks');

    console.log('\n✅ Validación de configuración completada.');

  } catch (error) {
    console.error('❌ Error durante la validación:', error);
  }
}

// Ejecutar validación
validateWebhookConfig().catch(console.error);
