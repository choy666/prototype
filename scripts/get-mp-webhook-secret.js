#!/usr/bin/env node

/**
 * Script para obtener el webhook secret real desde la API de MercadoPago
 * Usa el access token configurado para consultar las aplicaciones y webhooks
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

// Configuración desde entorno
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

if (!accessToken) {
    console.log('❌ ERROR: MERCADO_PAGO_ACCESS_TOKEN no está configurado');
    console.log('💡 Ejecuta: vercel env pull .env.local');
    process.exit(1);
}

console.log('=== OBTENIENDO WEBHOOK SECRET REAL ===\n');

// Opciones para la API de MercadoPago
const options = {
    hostname: 'api.mercadopago.com',
    port: 443,
    path: '/oauth/scopes',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            console.log('✅ Respuesta de MercadoPago:');
            console.log(JSON.stringify(response, null, 2));
            
            // Buscar aplicaciones con webhooks configurados
            if (response.applications) {
                console.log('\n🔍 Aplicaciones encontradas:');
                response.applications.forEach((app, index) => {
                    console.log(`${index + 1}. ID: ${app.id}`);
                    console.log(`   Name: ${app.name}`);
                    console.log(`   Description: ${app.description}`);
                    if (app.webhook_secret) {
                        console.log(`   🔑 WEBHOOK SECRET: ${app.webhook_secret}`);
                        console.log(`   ✅ ESTE ES EL SECRET QUE DEBES CONFIGURAR EN VERCEL`);
                    } else {
                        console.log(`   ❌ No tiene webhook secret configurado`);
                    }
                    console.log('');
                });
            }
            
        } catch (error) {
            console.log('❌ Error parseando respuesta:', error.message);
            console.log('Respuesta cruda:', data);
        }
    });
});

req.on('error', (error) => {
    console.log('❌ Error en la petición:', error.message);
});

req.end();
