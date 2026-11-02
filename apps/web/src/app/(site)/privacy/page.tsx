import type { Metadata } from 'next';
import { Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Privacy', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return (
    <main className="prose-page mx-auto max-w-3xl px-4 pt-8">
      <h1>Privacy</h1>
      <Notice tone="warn">This is a plain-language draft. Have it reviewed by a lawyer before public launch.</Notice>
      <h2>What we store</h2>
      <ul>
        <li>Your account details: name, username, email, and the profile details you choose to add.</li>
        <li>Your listings, photos, offers, favorites, messages, reports and reviews.</li>
        <li>Security records, such as active sessions and moderation actions.</li>
      </ul>
      <h2>What other people see</h2>
      <p>
        Others see your display name, username, profile photo, join date, listings and reviews. Listings show an approximate area, never your exact
        position. Your email address is not shown to other people. SellNest does not ask for your phone number; share one in a message only if you choose to.
      </p>
      <h2>Location</h2>
      <p>
        Using your device location is optional and needs your permission. It is used to find your nearest area, and that area is what is saved. You can
        always choose an area by hand instead.
      </p>
      <h2>Cookies</h2>
      <p>We use one cookie to keep you signed in and one to remember your chosen area. Recently viewed items are stored only in your browser.</p>
    </main>
  );
}
