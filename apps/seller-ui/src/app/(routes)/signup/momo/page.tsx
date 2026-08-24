"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const MomoSetup = () => {
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
        type: "momo",
        ...data,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      console.error(err);
      alert("Failed to save mobile money details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center pt-10 min-h-screen">
      <div className="md:w-[480px] p-8 bg-white shadow rounded-lg">
        <h3 className="text-2xl font-semibold text-center mb-4">MTN Mobile Money</h3>
        <form onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-gray-700 mb-1">Phone number</label>
          <input
            type="tel"
            className="w-full p-2 border border-gray-300 outline-0 rounded-[4px] mb-1"
            {...register("phone_number", { required: "Phone is required" })}
            placeholder="e.g. +233XXXXXXXXX"
          />
          {errors.phone_number && (
            <p className="text-red-500 text-sm">{String(errors.phone_number.message)}</p>
          )}

          <label className="block text-gray-700 mb-1">Momo pay code</label>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 outline-0 rounded-[4px] mb-1"
            {...register("momo_code", { required: "Momo code is required" })}
            placeholder="Mobile money code / shortcode"
          />
          {errors.momo_code && (
            <p className="text-red-500 text-sm">{String(errors.momo_code.message)}</p>
          )}

          <label className="block text-gray-700 mb-1">Name on number</label>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 outline-0 rounded-[4px] mb-1"
            {...register("name", { required: "Name is required" })}
            placeholder="Name associated with number"
          />
          {errors.name && (
            <p className="text-red-500 text-sm">{String(errors.name.message)}</p>
          )}

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 text-lg bg-blue-600 text-white py-2 rounded-lg"
            >
              {loading ? "Saving..." : "Save Mobile Money"}
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

export default MomoSetup;
