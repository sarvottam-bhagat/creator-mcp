import Link from 'next/link';

const LINKS = [
  'About us',
  'Privacy Policy',
  'Cookie Policy',
  'Terms of Service',
  'Contact us',
  'Careers',
  'Copyright',
  'Report Vulnerability',
  'Security Advice',
];

type Social = { label: string; path: string };

const SOCIALS: Social[] = [
  {
    label: 'Instagram',
    path: 'M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 2.5c-3.1 0-3.5 0-4.7.1-.9 0-1.3.2-1.6.3-.4.1-.6.3-.9.6-.3.3-.5.5-.6.9-.1.3-.3.7-.3 1.6-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c0 .9.2 1.3.3 1.6.1.4.3.6.6.9.3.3.5.5.9.6.3.1.7.3 1.6.3 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c.9 0 1.3-.2 1.6-.3.4-.1.6-.3.9-.6.3-.3.5-.5.6-.9.1-.3.3-.7.3-1.6.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c0-.9-.2-1.3-.3-1.6-.1-.4-.3-.6-.6-.9-.3-.3-.5-.5-.9-.6-.3-.1-.7-.3-1.6-.3-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4zm0 6.9a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4zm5.3-7.1a1 1 0 1 1-2 0 1 1 0 0 1 2 0z',
  },
  { label: 'YouTube', path: 'M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z' },
  { label: 'X', path: 'M17.5 3h3.1l-6.8 7.8L21.5 21h-5.7l-4.5-5.9L6.1 21H3l7.2-8.2L2.7 3h5.8l4.2 5.6L17.5 3zm-1.1 16.1h1.7L7.3 4.8H5.5l10.9 14.3z' },
  { label: 'LinkedIn', path: 'M6.5 8.5v11H3v-11h3.5zm.2-3.3a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0zM21 13.9v5.6h-3.5v-5.2c0-1.3-.5-2.2-1.6-2.2-.9 0-1.4.6-1.6 1.2-.1.2-.1.5-.1.8v5.4H10.7s.1-8.8 0-9.7h3.5v1.4c.5-.7 1.3-1.7 3.1-1.7 2.3 0 3.7 1.5 3.7 4.4z' },
  { label: 'Facebook', path: 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z' },
];

export default function Footer() {
  return (
    <footer className="mt-14 mr-8 border-t border-fm-divider pt-10 pb-12">
      <p className="max-w-lg text-sm text-fm-tertiary">
        Follow us for more stories! Your support fuels our mission to create the
        best audio series.
      </p>

      <div className="mt-5 flex items-center gap-3">
        {SOCIALS.map((s) => (
          <a
            key={s.label}
            href="#"
            aria-label={s.label}
            className="flex size-9 items-center justify-center rounded-full border-[0.8px] border-fm-border text-fm-secondary transition-colors hover:border-fm-border-bright hover:text-fm-primary"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
              <path d={s.path} />
            </svg>
          </a>
        ))}
      </div>

      <nav
        aria-label="Footer"
        className="mt-8 grid max-w-4xl grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {LINKS.map((l) => (
          <Link
            key={l}
            href="#"
            className="text-xs tracking-wide text-fm-tertiary uppercase transition-colors hover:text-fm-primary"
          >
            {l}
          </Link>
        ))}
      </nav>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-fm-divider pt-6">
        <p className="text-xs tracking-wide text-fm-tertiary uppercase">
          EchoFM
        </p>
        <p className="text-xs text-fm-tertiary">© {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
