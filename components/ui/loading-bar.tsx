'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface LoadingBarProps {
  isLoading: boolean;
  progress?: number;
  className?: string;
  height?: number;
  color?: string;
}

export function LoadingBar({ 
  isLoading, 
  progress, 
  className,
  height = 4,
  color = 'bg-blue-500'
}: LoadingBarProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setIsVisible(true);
      setInternalProgress(0);
      
      // Simular progreso si no se proporciona un valor específico
      if (progress === undefined) {
        const interval = setInterval(() => {
          setInternalProgress(prev => {
            if (prev >= 90) {
              clearInterval(interval);
              return 90;
            }
            return prev + Math.random() * 10;
          });
        }, 200);

        return () => clearInterval(interval);
      }
    } else {
      // Completar la barra cuando termina la carga
      setInternalProgress(100);
      
      // Ocultar la barra después de una pequeña animación
      const timeout = setTimeout(() => {
        setIsVisible(false);
        setInternalProgress(0);
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, progress]);

  const displayProgress = progress !== undefined ? progress : internalProgress;

  if (!isVisible && !isLoading) {
    return null;
  }

  return (
    <div 
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-gray-200',
        className
      )}
      style={{ height: `${height}px` }}
    >
      <div
        className={cn(
          'h-full transition-all duration-300 ease-out',
          color
        )}
        style={{
          width: `${displayProgress}%`,
          transition: isLoading ? 'width 0.2s ease-out' : 'width 0.3s ease-in'
        }}
      >
        <div className="h-full w-full bg-white opacity-20 animate-pulse" />
      </div>
    </div>
  );
}

// Componente simplificado para uso común
export function LoadingBarSimple({ isLoading }: { isLoading: boolean }) {
  return <LoadingBar isLoading={isLoading} />;
}

export default LoadingBar;
