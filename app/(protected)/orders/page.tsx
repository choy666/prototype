'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Order = {
  id: string;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    productImage?: string;
    quantity: number;
    price: number;
  }[];
  total: number;
};

export default function OrdersPage() {
  const { status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/orders');
      return;
    }

    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/orders');
        const data: Order[] = await res.json();
        setOrders(data);
      } catch (error) {
        console.error('Error al cargar órdenes:', error);
      }
    };

    if (status === 'authenticated') {
      fetchOrders();
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div>Cargando...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Historial de Compras</h1>
      {orders.length === 0 ? (
        <p>No tienes órdenes registradas.</p>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="border p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">Orden #{order.id}</h2>
              <p className="text-sm text-gray-500 mb-4">
                Fecha: {new Date(order.createdAt).toLocaleDateString()}
              </p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    <Image
                      src={item.productImage || '/placeholder-product.jpg'}
                      alt={item.productName}
                      width={50}
                      height={50}
                      className="rounded"
                    />
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} x ${item.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-bold">Total: ${order.total.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}