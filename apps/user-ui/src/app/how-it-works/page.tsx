export const metadata = { title: "How it works & policies" };

export default function HowItWorksPage() {
  return (
    <div className="container-x max-w-3xl space-y-10 py-12">
      <section>
        <h1 className="text-4xl font-semibold">How HUZA works</h1>
        <ol className="mt-6 space-y-4 text-stone-700">
          <li><strong>1. Browse & compare.</strong> Every listing shows what's included, requirements, service area and pricing options. Ask questions publicly on the listing.</li>
          <li><strong>2. Book with your date & time.</strong> Add services to your basket; we check each provider is free on your day.</li>
          <li><strong>3. Pay safely.</strong> Pay by MTN MoMo, Airtel Money or card — in full, or a deposit now and the balance later. HUZA holds the money.</li>
          <li><strong>4. Celebrate.</strong> About 2 weeks before your day (once fully paid) providers see your venue. On the day, chat and phone contact open.</li>
          <li><strong>5. Providers get paid after delivery.</strong> You have a short window after the event to confirm or report a problem. Then the provider is paid on the next Thursday.</li>
        </ol>
      </section>

      <section id="policies" className="space-y-6">
        <h2 className="text-2xl font-semibold">Payments & policies</h2>
        <div className="card p-5">
          <h3 className="font-semibold">Deposit or full payment</h3>
          <p className="mt-1 text-sm text-stone-700">Choose to pay in full, or a deposit (30%) now and the balance 14 days before the event. Bookings within 14 days of the event must be paid in full. If the balance isn't paid on time, the booking is cancelled under the cancellation policy below. A small booking fee applies to each booking.</p>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">If you cancel</h3>
          <ul className="mt-1 list-inside list-disc text-sm text-stone-700">
            <li>More than 90 days before the event: full refund of what you paid for the service</li>
            <li>30–90 days before: 50% refund</li>
            <li>Less than 30 days before: no refund</li>
            <li>You can reschedule once for free, if the provider is free on the new date</li>
            <li>The booking fee is not refundable when you cancel</li>
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">If a provider cancels</h3>
          <p className="mt-1 text-sm text-stone-700">You're notified straight away and offered available alternatives in the same category and price range. Choose a replacement (cheaper: we refund the difference; pricier: you pay the difference) or a full refund including the booking fee. Providers are never paid for services they didn't deliver.</p>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">If something goes wrong on the day</h3>
          <p className="mt-1 text-sm text-stone-700">Report it within the window after your event. Common problems have set partial refunds (e.g. significant lateness 20%, missing items 30–50%, no-show 100%), confirmed by our team after reviewing evidence from both sides. Payment to the provider is paused until then.</p>
        </div>
        <div className="card border-brand-200 bg-brand-50 p-5">
          <h3 className="font-semibold text-brand-900">Stay on HUZA</h3>
          <p className="mt-1 text-sm text-brand-900">Bookings made outside HUZA have no payment protection, no refunds and no replacement if the provider cancels. Contact details are shared on the wedding day.</p>
        </div>
      </section>
    </div>
  );
}
