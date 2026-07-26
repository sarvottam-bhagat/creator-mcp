'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

type Item = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const iconClass = 'size-6';

const ITEMS: Item[] = [
  {
    label: 'Home',
    href: '/',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClass}
        aria-hidden
      >
        <path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    label: 'Store',
    href: '/store',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className={iconClass}
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    ),
  },
  {
    label: 'Studio',
    href: '/studio',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClass}
        aria-hidden
      >
        <path d="M4 20h5l10.5-10.5a2.1 2.1 0 0 0-3-3L6 17v3z" />
        <path d="M14.5 6.5 17.5 9.5" />
      </svg>
    ),
  },
  {
    label: 'Marketing',
    href: '/marketing',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClass}
        aria-hidden
      >
        <path d="m4 12 12-7v14L4 12Z" />
        <path d="M16 9.5c2 .6 3.4 1.8 4 3.5-.6 1.7-2 2.9-4 3.5" />
      </svg>
    ),
  },
];

export default function IconRail({ userName = 'Sarvottam' }: { userName?: string }) {
  const pathname = usePathname();
  const initial = userName.trim().charAt(0).toUpperCase() || 'G';

  return (
    <nav
      aria-label="Main"
      className="fixed top-0 left-0 z-40 flex h-screen w-20 shrink-0 flex-col items-center bg-fm-bg pb-5"
    >
      <Link href="/" aria-label="EchoFM home" className="mt-4 mb-8 block">
        <Image
          src="/brand/echofm-logo.svg"
          alt="EchoFM"
          width={52}
          height={52}
          className="size-[52px] rounded-xl"
          priority
        />
      </Link>

      <ul className="flex w-full flex-col items-center gap-8">
        {ITEMS.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <li key={item.label} className="w-full">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex w-full flex-col items-center gap-1.5 py-3 text-[10px] font-medium tracking-wider uppercase transition-colors ${
                  active
                    ? 'text-fm-primary'
                    : 'text-fm-tertiary hover:text-fm-secondary'
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-r from-fm-accent/30 to-transparent"
                  />
                )}
                <span className="relative">{item.icon}</span>
                <span className="relative">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/profile"
        className="mt-auto flex flex-col items-center gap-1.5 text-[10px] font-medium tracking-wider text-fm-tertiary uppercase transition-colors hover:text-fm-secondary"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-fm-accent text-sm font-semibold text-white">
          {initial}
        </span>
        Profile
      </Link>
    </nav>
  );
}
