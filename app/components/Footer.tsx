import Link from 'next/link';
import { Facebook, Twitter, Instagram, Shield} from 'lucide-react';
import "../globals.css";
const Footer = () => {
  const currentYear = new Date().getFullYear();

  const social = [
    {
      name: 'Facebook',
      href: '#',
      icon: Facebook,
    },
    {
      name: 'Instagram',
      href: '#',
      icon: Instagram,
    },
    {
      name: 'Twitter',
      href: '#',
      icon: Twitter,
    },
  ];

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E5E7] py-5 sm:gap-2 sm:gap-6 md:pb-12 md:pt-10 dark:border-[#303236]">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid">
          <div className="space-y-8 col text-center">
            <h3 className="text-xl font-bold  text-[var(--color-page)]">MiTienda</h3>
            <p className="text-gray-500 text-base">
              La mejor selección de productos de calidad para todos los gustos y necesidades.
            </p>
            <div className="flex space-x-6 text-center d-flex justify-center">
              {social.map((item) => (
                <a key={item.name} href={item.href} className="hover:text-gray-500  text-[var(--color-page)]">
                  <span className="sr-only">{item.name}</span>
                  <item.icon className="h-6 w-6" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
          <div className="mt-12 col text-center">
              <div>
                <h3 className="text-xl font-semibold tracking-wider uppercase">
                  Contacto
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  <li>
                    <a href="mailto:info@mitienda.com" className="text-base text-gray-500 hover:text-green-500">
                      info@mitienda.com
                    </a>
                  </li>
                  <li>
                    <a href="tel:+1234567890" className="text-base text-gray-500 hover:text-green-500">
                      +1 (234) 567-890
                    </a>
                  </li>
                  <li className="text-base text-gray-500">
                    123 Calle Falsa, Ciudad, País
                  </li>
                </ul>
              </div>
            </div>
        </div>   
        <div className="mt-12 border-t border-gray-200 pt-8 text-center">
          <Link href="#" className="text-base text-yellow-500 hover:text-gray-600 flex items-center flex-col group transition-all duration-300 hover:scale-105 active:scale-95">
            &copy; {currentYear} LumenCommerce. Todos los derechos reservados.
            <Shield className="h-6 w-6 fill-[var(--color-page)] stroke-[var(--color-page)] transition-transform duration-300 group-hover:rotate-6" />
          </Link>
        </div>
      </div>        
    </footer>
  );
};
export default Footer;
