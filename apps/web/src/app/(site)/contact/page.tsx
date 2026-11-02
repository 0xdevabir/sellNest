import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Contact', alternates: { canonical: '/contact' } };

export default function ContactPage() {
  const email = process.env.CONTACT_EMAIL;
  return (
    <main className="prose-page mx-auto max-w-3xl px-4 pt-8">
      <h1>Contact</h1>
      <p>
        To report a listing or person, use <strong>Report</strong> on their page. That reaches moderators fastest and shows them what you are
        reporting.
      </p>
      {email ? (
        <p>
          For anything else, email <a href={`mailto:${email}`}>{email}</a>.
        </p>
      ) : (
        <p>A support email address has not been set up yet.</p>
      )}
      <p>
        Before you meet someone, read how to <Link href="/safety">stay safe</Link>.
      </p>
    </main>
  );
}
