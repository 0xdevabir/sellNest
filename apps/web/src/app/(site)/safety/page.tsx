import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Stay safe when buying and selling',
  description: 'How to meet, check items and pay safely when you buy or sell on SellNest.',
  alternates: { canonical: '/safety' },
};

export default function SafetyPage() {
  return (
    <main className="prose-page mx-auto max-w-3xl px-4 pt-8">
      <h1>Stay safe when buying and selling</h1>
      <p>
        SellNest connects buyers and sellers. It does not take payment, hold money, deliver items or guarantee a sale. You agree the price and the
        handover directly with the other person, so these habits matter.
      </p>
      <h2>Meeting</h2>
      <ul>
        <li>Meet somewhere public and busy, in daylight. A campus gate, cafeteria or shop is a good choice.</li>
        <li>Bring a friend for expensive items, and tell someone where you are going.</li>
        <li>Do not share your home address until you are sure you need to.</li>
      </ul>
      <h2>Paying</h2>
      <ul>
        <li>Check the item in person before any money changes hands.</li>
        <li>Never send an advance, deposit or mobile banking payment to hold an item you have not seen.</li>
        <li>Never share a bKash, Nagad or bank PIN or one-time code. Nobody genuine needs it.</li>
      </ul>
      <h2>Checking items</h2>
      <ul>
        <li>Power on electronics and test the things you care about, such as the camera, battery and charging.</li>
        <li>For phones, compare the IMEI on the box with the one in the phone&apos;s settings, and ask for the purchase receipt.</li>
        <li>Be careful with prices that look far too low.</li>
      </ul>
      <h2>If something feels wrong</h2>
      <p>
        Walk away. Use <strong>Report</strong> on the listing or profile so moderators can review it, and <strong>Block</strong> to stop someone
        messaging you. If you are in danger or have been defrauded, contact the police on 999.
      </p>
      <p>
        See also <Link href="/prohibited-items">prohibited items</Link> and <Link href="/contact">how to contact us</Link>.
      </p>
    </main>
  );
}
