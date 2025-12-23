import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const settings = await db.query.shippingSettings.findFirst();
    
    if (!settings) {
      return NextResponse.json({ error: 'No shipping settings found' });
    }

    return NextResponse.json({
      business_zip_code: settings.businessZipCode,
      local_shipping_cost: settings.localShippingCost,
      free_shipping_threshold: settings.freeShippingThreshold,
      tiendanube_enabled: settings.tiendanubeEnabled,
      tiendanube_store_id: settings.tiendanubeStoreId
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({ error: 'Error fetching settings' }, { status: 500 });
  }
}
