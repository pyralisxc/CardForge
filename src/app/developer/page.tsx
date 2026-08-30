import { permanentRedirect } from 'next/navigation';

export default function RetiredDeveloperProgramRoute() {
  permanentRedirect('/contributors');
}
