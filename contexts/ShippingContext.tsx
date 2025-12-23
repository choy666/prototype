// contexts/ShippingContext.tsx
// Contexto para manejar el estado del envío en el checkout

'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { ShippingOption } from '@/lib/services/unified-shipping';

interface ShippingContextType {
  selectedOption: ShippingOption | null;
  shippingCost: number;
  isLocalShipping: boolean;
  selectShippingOption: (option: ShippingOption) => void;
  clearShipping: () => void;
}

const ShippingContext = createContext<ShippingContextType | undefined>(undefined);

export function ShippingProvider({ children }: { children: ReactNode }) {
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);

  const shippingCost = selectedOption?.cost || 0;
  const isLocalShipping = selectedOption?.type === 'local';

  const selectShippingOption = (option: ShippingOption) => {
    setSelectedOption(option);
  };

  const clearShipping = () => {
    setSelectedOption(null);
  };

  return (
    <ShippingContext.Provider
      value={{
        selectedOption,
        shippingCost,
        isLocalShipping,
        selectShippingOption,
        clearShipping
      }}
    >
      {children}
    </ShippingContext.Provider>
  );
}

export function useShipping() {
  const context = useContext(ShippingContext);
  if (context === undefined) {
    throw new Error('useShipping must be used within a ShippingProvider');
  }
  return context;
}
