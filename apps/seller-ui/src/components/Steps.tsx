"use client";

const Steps = ({ active }: { active: number }) => (
  <div className="mb-8 flex items-center justify-between">
    {["Account", "Business", "Payout", "Verification"].map((label, i) => (
      <div key={label} className="flex flex-1 items-center">
        <div className="flex flex-col items-center gap-1">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${i + 1 <= active ? "bg-brand-700 text-white" : "bg-stone-200 text-stone-500"}`}>{i + 1}</span>
          <span className="text-xs text-stone-600">{label}</span>
        </div>
        {i < 3 && <div className={`mx-2 mb-5 h-0.5 flex-1 ${i + 1 < active ? "bg-brand-700" : "bg-stone-200"}`} />}
      </div>
    ))}
  </div>
);

export default Steps;
