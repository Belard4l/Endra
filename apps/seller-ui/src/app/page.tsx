import Link from "next/link";

const Page = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6">
      <div className="max-w-xl w-full p-8 bg-white rounded-3xl shadow-lg">
        <h1 className="text-4xl font-bold text-center mb-4">HUZA Seller Portal</h1>
        <p className="text-center text-gray-600 mb-8">
          Access seller signup, login, and payment profile management.
        </p>
        <div className="grid gap-4">
          <Link href="/signup" className="block w-full text-center py-4 rounded-xl bg-blue-600 text-white font-semibold">
            Seller Signup
          </Link>
          <Link href="/login" className="block w-full text-center py-4 rounded-xl bg-black text-white font-semibold">
            Seller Login
          </Link>
          <Link href="/profile" className="block w-full text-center py-4 rounded-xl bg-green-600 text-white font-semibold">
            Seller Profile
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Page;