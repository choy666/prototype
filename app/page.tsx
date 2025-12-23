// app/page.tsx
import Image from 'next/image';
import logo from '@/assets/logo.svg';
import logoDark from '@/assets/logo-dark.svg';
import Link from 'next/link';
import arrow from '@/assets/arrow.svg';
import FeaturedGrid from '@/components/products/FeaturedGrid';
import { getFeaturedProducts } from '@/lib/actions/products';
import HeroSlider from '@/components/ui/HeroSlider';
import { auth } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();

  if (session && session.user.role === 'admin') {
    redirect('/admin');
  }
  const featured = await getFeaturedProducts(5);
  return (
    <div className='flex min-h-screen flex-col'>
      <div className='mx-auto flex w-full max-w-md flex-1 flex-col px-5 md:max-w-lg md:px-0 lg:max-w-xl'>
        <main className='flex flex-1 flex-col justify-center'>
          <div className='mb-6 md:mb-7'>
            <div className='flex items-center gap-2 mb-4'>
              <div className='relative'>
                <Image
                  className='lg:h-7 lg:w-auto dark:hidden'
                  src={logo}
                  alt='Tienda en Proceso'
                  width={88}
                  height={24}
                  priority
                />
                <Image
                  className='hidden lg:h-7 lg:w-auto dark:block'
                  src={logoDark}
                  alt='Tienda en Proceso'
                  width={88}
                  height={24}
                  priority
                />
              </div>
              <span className='relative flex h-3 w-3'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75'></span>
                <span className='relative inline-flex rounded-full h-3 w-3 bg-yellow-500'></span>
              </span>
            </div>
            <div className='inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 mb-6'>
              <svg className='mr-2 h-4 w-4 animate-spin' viewBox='0 0 24 24'>
                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' fill='none'></circle>
                <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
              </svg>
              Tienda en Proceso de Creación
            </div>
          </div>
          <h1 className='text-2xl font-semibold leading-none tracking-tighter sm:text-3xl md:text-4xl lg:text-5xl lg:leading-none'>
            🛍️ Estamos Construyendo tu Experiencia de Compra
          </h1>
          <p className='mt-3.5 max-w-lg text-base leading-snug tracking-tight text-[#61646B] md:text-lg md:leading-snug lg:text-xl lg:leading-snug dark:text-[#94979E]'>
            <span className='font-semibold text-yellow-600 dark:text-yellow-400'>⚠️ Sitio en Desarrollo - No realizar compras</span><br/>
            Estamos trabajando para traerte la mejor experiencia de compra online. Pronto podrás disfrutar de nuestros productos con envíos rápidos y seguros.
          </p>
          <div className='mt-8 flex flex-wrap items-center gap-5 md:mt-9 lg:mt-10'>
            <Link
              className='rounded-full bg-gray-400 px-5 py-2.5 font-semibold tracking-tight text-white cursor-not-allowed opacity-75 lg:px-7 lg:py-3'
              href='#'
              onClick={(e) => e.preventDefault()}
            >
              🚧 Compras Deshabilitadas
            </Link>
            <Link
              className='group flex items-center gap-2 leading-none tracking-tight text-gray-500'
              href='https://github.com/choy666/prototype'
              target='_blank'
            >
              Ver Proyecto en GitHub
              <Image
                className='transition-transform duration-200 group-hover:translate-x-1 dark:invert'
                src={arrow}
                alt='arrow'
                width={16}
                height={10}
                priority
              />
            </Link>
          </div>
        </main>
      </div>
      <div className='flex min-h-screen flex-col'>
        <main className='flex flex-1 flex-col'>
          <section className='mx-auto w-full max-w-6xl px-5 py-10'>
            <h2 className='text-2xl font-semibold mb-6'>Destacados</h2>
            <FeaturedGrid products={featured} />
          </section>

          <section className='mx-auto w-full max-w-6xl px-5 py-10'>
            <h2 className='text-2xl font-semibold mb-6'>Más productos</h2>
            <HeroSlider />
          </section>
        </main>
      </div>
    </div>
  );
}
