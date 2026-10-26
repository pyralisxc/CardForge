import type { Metadata } from 'next';
import { PluginDownloadLinks } from '@/features/plugin-distribution/client';

export const metadata: Metadata = { title: 'CardForge Studio plugin download', description: 'Download the latest CardForge Studio plugin for Production or authorized Preview testing.' };
export default function DownloadsPage() {
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-12"><h1 className="text-3xl font-bold">CardForge plugins</h1><PluginDownloadLinks scope="studio" /></main>;
}
