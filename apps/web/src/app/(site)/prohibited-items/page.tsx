import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prohibited items',
  description: 'Items that cannot be listed on SellNest.',
  alternates: { canonical: '/prohibited-items' },
};

export default function ProhibitedPage() {
  return (
    <main className="prose-page mx-auto max-w-3xl px-4 pt-8">
      <h1>Prohibited items</h1>
      <p>You cannot list these on SellNest. Moderators remove listings that break this policy and may suspend the account.</p>
      <ul>
        <li>Weapons, ammunition, explosives and anything designed to hurt people</li>
        <li>Illegal drugs, drug paraphernalia, and tobacco or alcohol</li>
        <li>Prescription medicines</li>
        <li>Stolen goods, or anything you do not have the right to sell</li>
        <li>Counterfeit products and pirated software, films or books</li>
        <li>Fake or real identity documents, certificates, exam papers and academic work written for submission</li>
        <li>SIM cards registered in someone else&apos;s name, and accounts or login details</li>
        <li>Adult content and services</li>
        <li>Live animals and products from protected wildlife</li>
        <li>Hazardous chemicals and recalled products</li>
      </ul>
      <p>If you see one of these listed, use Report on the listing.</p>
    </main>
  );
}
