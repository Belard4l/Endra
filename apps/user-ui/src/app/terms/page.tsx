export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-3xl font-semibold">Terms of service</h1>
      <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Draft placeholder. HUZA's full terms for couples and providers (payments, fines, payouts, refunds, bans and data protection under Rwanda's
        2021 personal data law) must be written and reviewed by a lawyer before launch.
      </p>
      <p className="mt-6 text-stone-700">Until then, the rules described on the <a href="/how-it-works#policies" className="underline">How it works</a> page apply.</p>
    </div>
  );
}
