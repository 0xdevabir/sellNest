import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Terms of use', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return (
    <main className="prose-page mx-auto max-w-3xl px-4 pt-8">
      <h1>Terms of use</h1>
      <Notice tone="warn">This is a plain-language draft. Have it reviewed by a lawyer before public launch.</Notice>
      <h2>What SellNest is</h2>
      <p>
        SellNest is a place to list and find second-hand items. Sales happen directly between buyers and sellers. SellNest is not a party to any sale
        and does not offer payment, escrow, delivery tracking or buyer protection.
      </p>
      <h2>Your account</h2>
      <p>Keep your password private. You are responsible for what happens on your account. Tell us if you think someone else has accessed it.</p>
      <h2>Listings and messages</h2>
      <p>
        List only items you have the right to sell, and describe them honestly. Do not list <Link href="/prohibited-items">prohibited items</Link>,
        and do not harass, deceive or spam other people.
      </p>
      <h2>Moderation</h2>
      <p>Moderators can review, reject or remove listings, and restrict or suspend accounts that break these terms.</p>
      <h2>Reviews</h2>
      <p>Only a buyer the seller marked as purchaser can review that sale. Write only about your real experience.</p>
    </main>
  );
}
