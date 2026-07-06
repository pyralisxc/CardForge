
import type {Metadata} from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Geist, Geist_Mono } from 'next/font/google';
import { Cinzel, Lato } from 'next/font/google'; // Added Cinzel and Lato
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { isClerkServerConfigPresent } from '@/lib/clerkConfig';
import { getPublicAppUrl } from '@/lib/siteUrl';

const geistSans = Geist({ 
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({ 
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Initialize new fonts
const cinzel = Cinzel({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-cinzel',
});

const lato = Lato({
  weight: ['400', '700', '900'],
  subsets: ['latin'],
  variable: '--font-lato',
});


export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: {
    default: 'CardForge Studio | Build Cards Faster',
    template: '%s | CardForge Studio',
  },
  description: 'Design reusable card templates, generate full sets from structured data, and help grow a reviewed CardForge library for tabletop and card-system creators.',
  keywords: [
    'card maker',
    'TCG card generator',
    'tabletop card creator',
    'printable card templates',
    'bulk card generator',
    'card system studio',
    'developer asset pipeline',
    'fantasy card template editor',
    'local-first card design studio',
  ],
  openGraph: {
    title: 'CardForge Studio',
    description: 'Build cards faster, generate complete sets, and help shape the shared CardForge library.',
    url: '/',
    siteName: 'CardForge Studio',
    images: [
      {
        url: '/card-assets/landing/cardforge-hero-workbench.png',
        width: 1600,
        height: 900,
        alt: 'CardForge fantasy workbench with cards, frames, tools, parchment, and forge light',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CardForge Studio',
    description: 'Design reusable templates, generate full card sets, and help shape the shared forge library.',
    images: ['/card-assets/landing/cardforge-hero-workbench.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = (
    <>
      {children}
      <Toaster />
    </>
  );

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${lato.variable} font-sans antialiased`}>
        {isClerkServerConfigPresent()
          ? <ClerkProvider>{app}</ClerkProvider>
          : app}
      </body>
    </html>
  );
}

