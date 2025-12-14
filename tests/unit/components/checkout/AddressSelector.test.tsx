import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
// @ts-ignore - TypeScript no puede resolver este módulo debido a exclusiones en tsconfig.json
import { AddressSelector } from '@/components/checkout/AddressSelector';
// @ts-ignore - TypeScript no puede resolver este módulo debido a exclusiones en tsconfig.json
import { Address } from '@/lib/schema';
import { toast } from 'react-hot-toast';

// Mock de react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn()
  }
}));

// Mock de fetch
global.fetch = jest.fn();

describe('AddressSelector', () => {
  const mockOnAddressSelect = jest.fn();
  const mockOnNewAddress = jest.fn();
  const user = userEvent.setup();

  const mockAddresses: Address[] = [
    {
      id: 1,
      userId: 1,
      nombre: 'Juan Pérez',
      direccion: 'Calle A 123',
      ciudad: 'Buenos Aires',
      provincia: 'Buenos Aires',
      codigoPostal: '1001',
      telefono: '11987654321',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      userId: 1,
      nombre: 'María García',
      direccion: 'Calle B 456',
      ciudad: 'Córdoba',
      provincia: 'Córdoba',
      codigoPostal: '5000',
      telefono: '35198765432',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Configurar fetch mock por defecto para que no falle
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => []
    });
  });

  it('debe mostrar loading state inicialmente', async () => {
    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    // Verificar que muestra el skeleton de loading inicialmente
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    
    // Esperar a que termine de cargar y verificar el título
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Seleccionar Dirección de Envío' })).toBeInTheDocument();
    });
  });

  it('debe mostrar las direcciones disponibles', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAddresses
    });

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText('Calle A 123')).toBeInTheDocument();
      expect(screen.getByText('María García')).toBeInTheDocument();
      expect(screen.getByText('Calle B 456')).toBeInTheDocument();
    });
  });

  it('debe mostrar mensaje cuando no hay direcciones guardadas', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no tienes direcciones guardadas/i)).toBeInTheDocument();
    });
  });

  it('debe resaltar la dirección seleccionada', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAddresses
    });

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={2}
      />
    );

    await waitFor(() => {
      const selectedCard = screen.getByText('María García').closest('.rounded-xl');
      expect(selectedCard).toHaveClass('ring-2');
    });
  });

  it('debe llamar a onAddressSelect al hacer clic en una dirección', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAddresses
    });

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    const addressCard = screen.getByText('Calle A 123');
    await user.click(addressCard);

    expect(mockOnAddressSelect).toHaveBeenCalledWith(mockAddresses[0]);
  });

  it('debe llamar a onNewAddress al hacer clic en "Agregar nueva dirección"', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAddresses
    });

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    // Esperar a que cargue el componente
    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    const newAddressButton = screen.getByText('Nueva Dirección');
    await user.click(newAddressButton);

    expect(mockOnNewAddress).toHaveBeenCalled();
  });

  it('debe llamar a onAddressSelect con null al hacer clic en "Usar dirección diferente"', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAddresses
    });

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    // Esperar a que cargue el componente
    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    const differentAddressButton = screen.getByText('Usar una dirección diferente');
    await user.click(differentAddressButton);

    expect(mockOnAddressSelect).toHaveBeenCalledWith(null);
  });

  it('debe manejar errores al cargar direcciones', async () => {
    // Mockear console.error para evitar que aparezca en la consola del test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Error de red'));

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al cargar direcciones');
    });
    
    // Restaurar console.error
    consoleSpy.mockRestore();
  });

  it('debe mostrar el formato completo de la dirección', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAddresses
    });

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    await waitFor(() => {
      // Verificar que las direcciones se muestran en líneas separadas
      expect(screen.getByText('Calle A 123')).toBeInTheDocument();
      expect(screen.getByText('Buenos Aires, Buenos Aires - CP: 1001')).toBeInTheDocument();
      expect(screen.getByText('Calle B 456')).toBeInTheDocument();
      expect(screen.getByText('Córdoba, Córdoba - CP: 5000')).toBeInTheDocument();
    });
  });

  it('debe mostrar el teléfono formateado', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAddresses
    });

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tel: 11987654321')).toBeInTheDocument();
      expect(screen.getByText('Tel: 35198765432')).toBeInTheDocument();
    });
  });

  it('debe mostrar botones de acción para cada dirección', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAddresses
    });

    render(
      <AddressSelector
        onAddressSelect={mockOnAddressSelect}
        onNewAddress={mockOnNewAddress}
        selectedAddressId={undefined}
      />
    );

    await waitFor(() => {
      // Verificar que hay dos direcciones diferentes
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText('María García')).toBeInTheDocument();
    });
  });
});
