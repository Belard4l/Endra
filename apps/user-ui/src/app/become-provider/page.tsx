import Link from "next/link";

export const metadata = { title: "Become a provider" };

const SELLER = process.env.NEXT_PUBLIC_SELLER_UI_URL || "http://localhost:3001";

export default function BecomeProviderPage() {
  const steps = [
    ["Create your account", "Sign up with your email and Rwandan phone number."],
    ["Set up your business profile", "Category, district, bio and photos."],
    ["Add your payout details", "MTN MoMo, Airtel Money or a Rwandan bank account."],
    ["Get verified", "Upload your national ID (and RDB certificate for companies). We review within 1–2 working days."],
    ["List your services", "Photos, what's included, requirements and pricing options like guest tiers or add-ons."],
  ];
  return (
    <div className="container-x max-w-4xl py-12">
      <h1 className="text-4xl font-semibold">Grow your wedding business with HUZA</h1>
      <p className="mt-3 text-lg text-stone-600">Couples across Rwanda plan and pay for their whole wedding on HUZA. You get guaranteed payment for every wedding you deliver.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Guaranteed payment", "Couples pay upfront. HUZA holds it and pays you every Thursday after you deliver."],
          ["Paid to MoMo or bank", "85% of each booking after processing fees — no chasing clients for money."],
          ["More weddings, more visibility", "Every wedding you deliver and every great review moves you up the rankings."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-stone-600">{d}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-12 text-2xl font-semibold">How to join</h2>
      <ol className="mt-4 space-y-3">
        {steps.map(([t, d], i) => (
          <li key={t} className="card flex gap-4 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 font-bold text-white">{i + 1}</span>
            <span><span className="font-semibold">{t}.</span> <span className="text-stone-600">{d}</span></span>
          </li>
        ))}
      </ol>
      <div className="card mt-8 p-5 text-sm text-stone-700">
        <h3 className="font-semibold">Reliability matters</h3>
        <p className="mt-1">
          Cancelling a confirmed booking leads to a fine (10–30% of the booking depending on notice, 50% for a no-show) and a strike, unless you prove an
          emergency. 2 strikes in 12 months lower your placement, 3 suspend your account. Sharing contact details before the wedding day is not allowed.
        </p>
      </div>
      <a href={`${SELLER}/signup`} className="btn-primary mt-8 px-8 py-3 text-base">Start as a provider</a>
      <p className="mt-3 text-sm text-stone-500">Already a provider? <a className="underline" href={`${SELLER}/login`}>Log in</a> · <Link href="/how-it-works" className="underline">How HUZA works</Link></p>
    </div>
  );
}
