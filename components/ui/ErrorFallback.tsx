'use client';

export default function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          ¡Ups! Algo salió mal
        </h1>
        <p className="text-gray-600 mb-4">
          Ha ocurrido un error inesperado. Por favor, recarga la página.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Recargar página
        </button>
      </div>
    </div>
  );
}
