import { createTiendanubeClient } from '@/lib/clients/tiendanube';

interface TiendanubeScriptResponse {
  id: string;
  name: string;
  script: string;
  pages: string[];
  position: string;
  created_at: string;
  updated_at: string;
}

interface TiendanubeScriptsListResponse {
  data: TiendanubeScriptResponse[];
}

interface TiendanubeScriptResponseSingle {
  data: TiendanubeScriptResponse;
}

export interface ScriptConfig {
  name: string;
  type: 'css' | 'js';
  content: string;
  pages: ('home' | 'product' | 'category' | 'cart')[];
  position?: 'head' | 'footer';
}

export interface AssetUrl {
  css?: string;
  js?: string;
  images?: string;
}

export class TiendanubeScriptManager {
  private storeId: string;
  private baseUrl: string;
  private client: ReturnType<typeof createTiendanubeClient>;

  constructor(storeId: string) {
    this.storeId = storeId;
    this.baseUrl = process.env.INTEGRATION_WEBHOOKS_BASE_URL || 'http://localhost:3000';
    this.client = createTiendanubeClient({ storeId, accessToken: 'placeholder' });
  }

  /**
   * Deploy CSS personalizado a Tiendanube
   */
  async deployCSS(css: string, pages: ScriptConfig['pages'], name?: string) {
    const scriptContent = `
(function() {
  var style = document.createElement('style');
  style.textContent = ${JSON.stringify(css)};
  document.head.appendChild(style);
})();
    `;

    return this.deployScript({
      name: name || `custom-css-${Date.now()}`,
      type: 'css',
      content: scriptContent,
      pages,
      position: 'head'
    });
  }

  /**
   * Deploy JavaScript personalizado a Tiendanube
   */
  async deployJS(js: string, pages: ScriptConfig['pages'], name?: string) {
    return this.deployScript({
      name: name || `custom-js-${Date.now()}`,
      type: 'js',
      content: js,
      pages,
      position: 'footer'
    });
  }

  /**
   * Deploy un script completo
   */
  private async deployScript(config: ScriptConfig) {
    try {
      const response = await this.client.post('/scripts', {
        name: config.name,
        event: 'page_load',
        script: config.content,
        pages: config.pages,
        position: config.position || 'head'
      }) as TiendanubeScriptResponseSingle;

      console.log(`[Tiendanube] Script ${config.name} deployado exitosamente`);
      return response.data;
    } catch (error) {
      console.error(`[Tiendanube] Error deployando script ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Listar todos los scripts activos
   */
  async listScripts() {
    try {
      const response = await this.client.get('/scripts') as TiendanubeScriptsListResponse;
      return response.data;
    } catch (error) {
      console.error('[Tiendanube] Error listando scripts:', error);
      throw error;
    }
  }

  /**
   * Actualizar un script existente
   */
  async updateScript(scriptId: string, updates: Partial<ScriptConfig>) {
    try {
      const updateData: {
        script?: string;
        pages?: string[];
        name?: string;
      } = {};
      
      if (updates.content) {
        updateData.script = updates.type === 'css' 
          ? `(function(){var style=document.createElement('style');style.textContent=${JSON.stringify(updates.content)};document.head.appendChild(style);})();`
          : updates.content;
      }
      
      if (updates.pages) updateData.pages = updates.pages;
      if (updates.name) updateData.name = updates.name;

      const response = await this.client.put(`/scripts/${scriptId}`, updateData) as TiendanubeScriptResponseSingle;
      console.log(`[Tiendanube] Script ${scriptId} actualizado`);
      return response.data;
    } catch (error) {
      console.error(`[Tiendanube] Error actualizando script ${scriptId}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar un script
   */
  async removeScript(scriptId: string) {
    try {
      await this.client.delete(`/scripts/${scriptId}`);
      console.log(`[Tiendanube] Script ${scriptId} eliminado`);
    } catch (error) {
      console.error(`[Tiendanube] Error eliminando script ${scriptId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener URLs públicas para assets
   */
  getAssetUrls(): AssetUrl {
    return {
      css: `${this.baseUrl}/tiendanube-assets/css/styles.css`,
      js: `${this.baseUrl}/tiendanube-assets/js/components.js`,
      images: `${this.baseUrl}/tiendanube-assets/images/`
    };
  }

  /**
   * Deploy bundle completo (CSS + JS + imágenes)
   */
  async deployFullBundle(config: {
    css: string;
    js: string;
    pages: ScriptConfig['pages'];
    cssName?: string;
    jsName?: string;
  }) {
    const results = await Promise.all([
      this.deployCSS(config.css, config.pages, config.cssName),
      this.deployJS(config.js, config.pages, config.jsName)
    ]);

    return {
      css: results[0],
      js: results[1],
      assetUrls: this.getAssetUrls()
    };
  }

  /**
   * Limpiar todos los scripts personalizados
   */
  async clearCustomScripts() {
    try {
      const scripts = await this.listScripts();
      const customScripts = scripts.filter((s: { 
        id: string; 
        name: string; 
        script: string; 
        pages: string[]; 
        position: string; 
        created_at: string; 
        updated_at: string; 
      }) => 
        s.name.includes('custom-') || s.name.includes('tiendanube-')
      );

      await Promise.all(
        customScripts.map((script: { id: string }) => this.removeScript(script.id))
      );

      console.log(`[Tiendanube] Eliminados ${customScripts.length} scripts personalizados`);
    } catch (error) {
      console.error('[Tiendanube] Error limpiando scripts:', error);
      throw error;
    }
  }
}
