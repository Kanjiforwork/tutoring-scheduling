import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Bright Path · Daily schedule', description: 'A clear daily schedule for the Bright Path reception team.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
