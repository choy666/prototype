require('dotenv').config({ path: '.env.local' });
const https = require('https');

console.log('=== VERIFICANDO WEBHOOK SECRET ===\n');

// Verificar variables de entorno
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

console.log('📋 Variables de entorno:');
console.log('✅ MERCADO_PAGO_ACCESS_TOKEN:', accessToken ? `${accessToken.substring(0, 20)}...` : '❌ NO CONFIGURADO');
console.log('✅ MERCADO_PAGO_WEBHOOK_SECRET:', webhookSecret ? `${webhookSecret.substring(0, 4)}...${webhookSecret.substring(webhookSecret.length - 4)}` : '❌ NO CONFIGURADO');

if (!accessToken || !webhookSecret) {
    console.log('\n❌ ERROR: Faltan variables de entorno críticas');
    console.log('💡 Solución: Verifica tu archivo .env.local');
    process.exit(1);
}

// Función para hacer petición a la API de MercadoPago
function getMercadoPagoApps() {
    return new Promise((resolve, reject) => {
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
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout en petición a MercadoPago'));
        });
        req.end();
    });
}

// Ejecutar consulta
(async () => {
    try {
        console.log('\n🔍 Consultando aplicaciones en MercadoPago...');
        const response = await getMercadoPagoApps();
        
        console.log('✅ Respuesta obtenida:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.applications && response.applications.length > 0) {
            console.log('\n🎯 Análisis de Webhook Secret:');
            
            let foundMatchingSecret = false;
            response.applications.forEach((app, index) => {
                console.log(`\n${index + 1}. ${app.name || 'App sin nombre'} (ID: ${app.id})`);
                
                if (app.webhook_secret) {
                    console.log(`   🔑 Webhook Secret: ${app.webhook_secret}`);
                    
                    if (app.webhook_secret === webhookSecret) {
                        console.log('   ✅ ✅ ✅ ¡SECRET COINCIDE! ✅ ✅ ✅');
                        console.log('   🎉 El webhook secret está correctamente configurado');
                        foundMatchingSecret = true;
                    } else {
                        console.log('   ❌ ❌ ❌ SECRET NO COINCIDE ❌ ❌ ❌');
                        console.log('   📝 Secret actual en .env.local:', webhookSecret);
                        console.log('   📝 Secret real en MercadoPago:', app.webhook_secret);
                        console.log('   💡 Debes actualizar MERCADO_PAGO_WEBHOOK_SECRET en Vercel');
                    }
                } else {
                    console.log('   ⚠️  No tiene webhook secret configurado');
                }
            });
            
            if (!foundMatchingSecret && response.applications.some(app => app.webhook_secret)) {
                console.log('\n🔧 INSTRUCCIONES PARA CORREGIR:');
                console.log('1. Copia el webhook secret real mostrado arriba');
                console.log('2. Ejecuta: vercel env add MERCADO_PAGO_WEBHOOK_SECRET production');
                console.log('3. Pega el secret cuando te lo pida');
                console.log('4. Ejecuta: vercel env pull .env.local');
                console.log('5. Reinicia tu aplicación');
            } else if (foundMatchingSecret) {
                console.log('\n🎉 ¡TODO CORRECTO! El webhook secret está bien configurado');
                console.log('💡 Si los webhooks siguen fallando, el problema puede ser otro');
            }
        } else {
            console.log('\n⚠️  No se encontraron aplicaciones con webhooks configurados');
            console.log('💡 Verifica que el access token sea correcto y tenga permisos');
        }
        
    } catch (error) {
        console.log('\n❌ Error consultando MercadoPago:', error.message);
        
        if (error.message.includes('401') || error.message.includes('403')) {
            console.log('💡 El access token puede estar expirado o ser inválido');
            console.log('💡 Genera un nuevo token en el dashboard de MercadoPago');
        } else if (error.message.includes('timeout')) {
            console.log('💡 Problema de conexión. Intenta de nuevo más tarde');
        }
    }
})();
