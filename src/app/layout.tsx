
import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Cinzel, Lato } from 'next/font/google'; // Added Cinzel and Lato
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

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
  title: 'CardForge',
  description: 'Create and print custom cards.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${lato.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

