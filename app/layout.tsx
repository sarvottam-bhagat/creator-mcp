import type { Metadata } from 'next';
import './globals.css';
import IconRail from '@/components/IconRail';

export const metadata: Metadata = {
  title: 'EchoFM: Audio Series & Stories',
  description:
    'Listen to free audio series and stories on EchoFM — thrillers, fantasy, romance and more.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-fm-bg text-fm-primary">
        <IconRail />
        {/* Rail is fixed at 80px; content sits beside it. */}
        <div className="ml-20 min-w-0">{children}</div>
      </body>
    </html>
  );
}
