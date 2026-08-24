"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const BankSetup = () => {
  const search = useSearchParams();
  const sellerId = search?.get("sellerId") || "";
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (data: any) => {
    if (!sellerId) return alert("Missing seller id");
    setLoading(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URI}/api/save-seller-payment`, {
        sellerId,
        type: "bank",
        ...data,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      console.error(err);
      alert("Failed to save bank details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center pt-10 min-h-screen">
      <div className="md:w-[480px] p-8 bg-white shadow rounded-lg">
        <h3 className="text-2xl font-semibold text-center mb-4">Bank Account</h3>
        <form onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-gray-700 mb-1">Bank name</label>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 outline-0 rounded-[4px] mb-1"
            {...register("bank_name", { required: "Bank name is required" })}
          />
          {errors.bank_name && (
            <p className="text-red-500 text-sm">{String(errors.bank_name.message)}</p>
          )}

          <label className="block text-gray-700 mb-1">Account number</label>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 outline-0 rounded-[4px] mb-1"
            {...register("account_number", { required: "Account number is required" })}
          />
          {errors.account_number && (
            <p className="text-red-500 text-sm">{String(errors.account_number.message)}</p>
          )}

          <label className="block text-gray-700 mb-1">Account name</label>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 outline-0 rounded-[4px] mb-1"
            {...register("account_name", { required: "Account name is required" })}
          />
          {errors.account_name && (
            <p className="text-red-500 text-sm">{String(errors.account_name.message)}</p>
          )}

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 text-lg bg-blue-600 text-white py-2 rounded-lg"
            >
              {loading ? "Saving..." : "Save Bank Details"}
            </button>

            <Link href="/signup" className="flex-1 text-center text-lg bg-gray-200 py-2 rounded-lg">
              Back
            </Link>
          </div>

          {success && <p className="text-green-600 text-center mt-3">Saved — redirecting…</p>}
        </form>
      </div>
    </div>
  );
};

export default BankSetup;
