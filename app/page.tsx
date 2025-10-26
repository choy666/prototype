// app/page.tsx
import Image from 'next/image';
import logo from '@/assets/logo.svg';
import logoDark from '@/assets/logo-dark.svg';
import Link from 'next/link';
import arrow from '@/assets/arrow.svg';
import { checkDatabaseConnection } from '@/lib/db';
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
  const dbStatus = await checkDatabaseConnection();
  const isConnected = dbStatus.success;
  const statusMessage = dbStatus.message;
  const featured = await getFeaturedProducts(5);
  return (
    <div className='flex min-h-screen flex-col'>
      <div className='mx-auto flex w-full max-w-md flex-1 flex-col px-5 md:max-w-lg md:px-0 lg:max-w-xl'>
        <main className='flex flex-1 flex-col justify-center'>
          <div className='mb-6 md:mb-7'>
            <Image
              className='lg:h-7 lg:w-auto dark:hidden'
              src={logo}
              alt='Neon logo'
              width={88}
              height={24}
              priority
            />
            <Image
              className='hidden lg:h-7 lg:w-auto dark:block'
              src={logoDark}
              alt='Neon logo'
              width={88}
              height={24}
              priority
            />
          </div>
          <h1 className='text-3xl font-semibold leading-none tracking-tighter md:text-4xl md:leading-none lg:text-5xl lg:leading-none'>
            Vercel with Neon Postgres
          </h1>
          <p className='mt-3.5 max-w-lg text-base leading-snug tracking-tight text-[#61646B] md:text-lg md:leading-snug lg:text-xl lg:leading-snug dark:text-[#94979E]'>
            A minimal template for building full-stack React applications using Next.js, Vercel, and
            Neon.
          </p>
          <div className='mt-8 flex flex-wrap items-center gap-5 md:mt-9 lg:mt-10'>
            <Link
              className='rounded-full bg-[#00E599] px-5 py-2.5 font-semibold tracking-tight text-[#0C0D0D] transition-colors duration-200 hover:bg-[#00E5BF] lg:px-7 lg:py-3'
              href='https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fneondatabase-labs%2Fvercel-marketplace-neon%2Ftree%2Fmain&project-name=my-vercel-neon-app&repository-name=my-vercel-neon-app&products=[{%22type%22:%22integration%22,%22integrationSlug%22:%22neon%22,%22productSlug%22:%22neon%22,%22protocol%22:%22storage%22}]'
              target='_blank'
            >
              Deploy to Vercel
            </Link>
            <Link
              className='group flex items-center gap-2 leading-none tracking-tight'
              href='https://github.com/neondatabase-labs/vercel-marketplace-neon'
              target='_blank'
            >
              View on GitHub
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
          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold mt-9 text-center ${
              isConnected
                ? 'border-[#00E599]/20 bg-[#00E599]/10 text-[#1a8c66] dark:bg-[#00E599]/10 dark:text-[#00E599]'
                : 'border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-500'
            }`}
          >
            {statusMessage}
          </span>
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
