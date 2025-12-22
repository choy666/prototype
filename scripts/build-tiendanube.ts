#!/usr/bin/env node

/**
 * Build script para Tiendanube Assets
 * Compila y optimiza CSS/JS para deploy en Tiendanube
 */

import { build } from 'vite';
import { resolve } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const config = {
  // Configuración de paths
  srcDir: resolve(process.cwd(), 'tiendanube-assets'),
  distDir: resolve(process.cwd(), 'public/tiendanube'),
  
  // Configuración de build
  cssInput: 'css/base.css',
  jsInput: 'js/components.js'
};

async function buildCSS() {
  console.log('🎨 Construyendo CSS...');
  
  const cssPath = resolve(config.srcDir, config.cssInput);
  const cssContent = await import('fs').then(fs => fs.promises.readFile(cssPath, 'utf8'));
  
  // Escribir CSS directamente sin procesamiento PostCSS para evitar errores
  const outputPath = resolve(config.distDir, 'css/styles.css');
  mkdirSync(resolve(outputPath, '..'), { recursive: true });
  writeFileSync(outputPath, cssContent);
  
  console.log(`✅ CSS guardado en: ${outputPath}`);
  console.log(`   Tamaño: ${cssContent.length} bytes`);
  
  return cssContent;
}

async function buildJS() {
  console.log('⚡ Construyendo JavaScript...');
  
  // Configuración de Vite para build
  const viteConfig = {
    build: {
      lib: {
        entry: resolve(config.srcDir, config.jsInput),
        name: 'TiendanubeComponents',
        fileName: 'components'
      },
      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM'
          }
        }
      },
      outDir: config.distDir,
      emptyOutDir: false,
      minify: 'terser' as const,
      sourcemap: true
    },
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  };
  
  // Build con Vite
  await build(viteConfig);
  
  const outputPath = resolve(config.distDir, 'js/components.js');
  console.log(`✅ JS guardado en: ${outputPath}`);
  
  // Leer tamaño
  const stats = await import('fs').then(fs => fs.promises.stat(outputPath));
  console.log(`   Tamaño: ${stats.size} bytes`);
  
  return outputPath;
}

async function generateManifest(cssPath: string, jsPath: string) {
  console.log('📋 Generando manifest...');
  
  const manifest = {
    version: Date.now(),
    generated: new Date().toISOString(),
    assets: {
      css: {
        path: '/tiendanube/css/styles.css',
        size: (await import('fs').then(fs => fs.promises.stat(cssPath))).size,
        hash: await generateFileHash(cssPath)
      },
      js: {
        path: '/tiendanube/js/components.js',
        size: (await import('fs').then(fs => fs.promises.stat(jsPath))).size,
        hash: await generateFileHash(jsPath)
      }
    },
    config: {
      pages: ['home', 'product', 'category', 'cart'],
      breakpoints: {
        mobile: '640px',
        tablet: '768px',
        desktop: '1024px'
      }
    }
  };
  
  const manifestPath = resolve(config.distDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`✅ Manifest guardado en: ${manifestPath}`);
  return manifest;
}

async function generateFileHash(filePath: string): Promise<string> {
  const crypto = await import('crypto');
  const content = await import('fs').then(fs => fs.promises.readFile(filePath));
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

async function copyImages() {
  console.log('🖼️ Copiando imágenes...');
  
  const imagesSrc = resolve(config.srcDir, 'images');
  const imagesDist = resolve(config.distDir, 'images');
  
  if (existsSync(imagesSrc)) {
    mkdirSync(imagesDist, { recursive: true });
    
    const { copyFileSync, readdirSync } = await import('fs');
    const files = readdirSync(imagesSrc);
    
    files.forEach(file => {
      const srcPath = resolve(imagesSrc, file);
      const distPath = resolve(imagesDist, file);
      copyFileSync(srcPath, distPath);
    });
    
    console.log(`✅ ${files.length} imágenes copiadas`);
  } else {
    console.log('⚠️  No se encontró directorio de imágenes');
  }
}

async function main() {
  console.log('🚀 Iniciando build de assets para Tiendanube...\n');
  
  try {
    // Crear directorio de salida
    mkdirSync(config.distDir, { recursive: true });
    
    // Build assets
    const cssPath = await buildCSS();
    const jsPath = await buildJS();
    await copyImages();
    
    // Generar manifest
    const manifest = await generateManifest(cssPath, jsPath);
    
    console.log('\n✨ Build completado exitosamente!');
    console.log(`📁 Directorio de salida: ${config.distDir}`);
    console.log(`🔗 URLs de producción:`);
    console.log(`   CSS: ${process.env.INTEGRATION_WEBHOOKS_BASE_URL}${manifest.assets.css.path}`);
    console.log(`   JS: ${process.env.INTEGRATION_WEBHOOKS_BASE_URL}${manifest.assets.js.path}`);
    
    // Guardar config para deploy
    const deployConfig = {
      storeId: process.env.TIENDANUBE_STORE_ID,
      baseUrl: process.env.INTEGRATION_WEBHOOKS_BASE_URL,
      manifest
    };
    
    writeFileSync(
      resolve(config.distDir, 'deploy-config.json'),
      JSON.stringify(deployConfig, null, 2)
    );
    
  } catch (error) {
    console.error('❌ Error en el build:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as buildTiendanube };
