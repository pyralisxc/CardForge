import { redirect } from 'next/navigation';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'CardForge Profile',
  description: 'Manage your CardForge profile.',
  path: '/profile',
  index: false,
});

export default function ProfilePage() {
  redirect('/account?section=profile');
}
