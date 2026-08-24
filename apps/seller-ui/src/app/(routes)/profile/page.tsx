"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import Link from "next/link";

const ProfilePage = () => {
  const [seller, setSeller] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      paymentMethod: "",
      phone_number: "",
      momo_code: "",
      name: "",
      bank_name: "",
      account_number: "",
      account_name: "",
    },
  });

  const selectedMethod = watch("paymentMethod");

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_SERVER_URI}/api/logged-in-seller`, {
          withCredentials: true,
        });
        setSeller(response.data.seller);
        reset({
          paymentMethod: response.data.seller.paymentMethod || "",
          phone_number: response.data.seller.momoPhoneNumber || "",
          momo_code: response.data.seller.momoCode || "",
          name: response.data.seller.momoName || "",
          bank_name: response.data.seller.bankName || "",
          account_number: response.data.seller.bankAccountNumber || "",
          account_name: response.data.seller.bankAccountName || "",
        });
      } catch (err) {
        setError("Unable to load seller profile. Please log in.");
      } finally {
        setLoading(false);
      }
    };

    fetchSeller();
  }, [reset]);

  const onSubmit = async (data: any) => {
    if (!seller?.id) return;
    setSaving(true);
    setSuccess(false);
    try {
      const paymentData: any = {
        sellerId: seller.id,
        type: data.paymentMethod,
      };

      if (data.paymentMethod === "momo") {
        paymentData.phone_number = data.phone_number;
        paymentData.momo_code = data.momo_code;
        paymentData.name = data.name;
      } else if (data.paymentMethod === "bank") {
        paymentData.bank_name = data.bank_name;
        paymentData.account_number = data.account_number;
        paymentData.account_name = data.account_name;
      }

      await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URI}/api/save-seller-payment`, paymentData, {
        withCredentials: true,
      });
      setSuccess(true);
    } catch (err) {
      setError("Failed to save payment details. Please check your fields.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading profile…</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/login" className="px-6 py-3 bg-black text-white rounded-lg">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-1 mb-6">
          <h1 className="text-3xl font-bold">Seller Profile</h1>
          <p className="text-gray-600">Manage your payment details for future withdrawals.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_1fr] mb-8">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">Seller name</p>
            <p className="text-lg font-semibold">{seller?.name}</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">Email</p>
            <p className="text-lg font-semibold">{seller?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-gray-700 mb-2">Payment method</label>
            <select
              className="w-full p-3 border border-gray-300 rounded-xl"
              {...register("paymentMethod", { required: "Select payment method" })}
            >
              <option value="">Choose payment method</option>
              <option value="momo">MTN Mobile Money</option>
              <option value="bank">Bank Account</option>
            </select>
            {errors.paymentMethod && (
              <p className="text-red-500 text-sm mt-1">{String(errors.paymentMethod.message)}</p>
            )}
          </div>

          {selectedMethod === "momo" && (
            <div className="grid gap-4">
              <div>
                <label className="block text-gray-700 mb-2">Phone number</label>
                <input
                  type="tel"
                  className="w-full p-3 border border-gray-300 rounded-xl"
                  {...register("phone_number", { required: "Phone number is required" })}
                  placeholder="e.g. +233XXXXXXXXX"
                />
                {errors.phone_number && (
                  <p className="text-red-500 text-sm mt-1">{String(errors.phone_number.message)}</p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Mobile money code</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-xl"
                  {...register("momo_code", { required: "Momo code is required" })}
                />
                {errors.momo_code && (
                  <p className="text-red-500 text-sm mt-1">{String(errors.momo_code.message)}</p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Name on number</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-xl"
                  {...register("name", { required: "Name is required" })}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{String(errors.name.message)}</p>
                )}
              </div>
            </div>
          )}

          {selectedMethod === "bank" && (
            <div className="grid gap-4">
              <div>
                <label className="block text-gray-700 mb-2">Bank name</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-xl"
                  {...register("bank_name", { required: "Bank name is required" })}
                />
                {errors.bank_name && (
                  <p className="text-red-500 text-sm mt-1">{String(errors.bank_name.message)}</p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Account number</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-xl"
                  {...register("account_number", { required: "Account number is required" })}
                />
                {errors.account_number && (
                  <p className="text-red-500 text-sm mt-1">{String(errors.account_number.message)}</p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Account name</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-xl"
                  {...register("account_name", { required: "Account name is required" })}
                />
                {errors.account_name && (
                  <p className="text-red-500 text-sm mt-1">{String(errors.account_name.message)}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold"
            >
              {saving ? "Saving…" : "Save Payment Details"}
            </button>
            <Link href="/" className="px-6 py-3 rounded-xl border border-gray-300 text-gray-800">
              Back Home
            </Link>
          </div>

          {success && <p className="text-green-600">Payment details saved successfully.</p>}
          {error && <p className="text-red-600">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
