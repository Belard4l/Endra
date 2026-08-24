import crypto from "crypto";
import { ValidationError } from "@packages/error-handler";
import redis from "@packages/libs/redis";
import { sendEmail } from "./sendMail";
import { Request, Response, NextFunction } from "express";
import prisma from "@packages/libs/prisma";


const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegistrationData = (
    data: any,
    userType: "user" | "seller"
) => {
    const { name, email, password, phone_number, country } = data;
    if (
        !name ||
        !email ||
        !password ||
        (userType === "seller" && (!phone_number || !country))
    ) {
        throw new ValidationError(`Missing required fields`);
    }
    if (!emailRegex.test(email)) {
        throw new ValidationError(`Invalid email format`);
    }
};

export const checkOtpRestrictions = async (
    email: string,
    next: NextFunction
) => {
    if (await redis.get(`otp_lock:${email}`)) {
        return next(
            new ValidationError(
                "Too many incorrect OTP attempts. Please try again after 30 minutes."
            )
        );
    }
    if (await redis.get(`otp_spam_lock:${email}`)) {
        return next(
            new ValidationError(
                "Too many OTP requests. Please try again after 1 hour."
            )
        );
    }
    if (await redis.get(`otp_cooldown:${email}`)) {
        return next(
            new ValidationError(
                "Please wait 1 minute before requesting another OTP."
            )
        );
    }
};
export const trackOtpRequests = async (email: string, next: NextFunction) => {
    const otpRequestKey = `otp_request_count:${email}`;
    let otpRequests = parseInt((await redis.get(otpRequestKey)) || "0");

    if (otpRequests >= 4) {
        await redis.set(`otp_spam_lock:${email}`, "locked", "EX", 3600);
        return next(
            new ValidationError(
                "Too many OTP requests. Please try again after 1 hour."
            )
        );
    }

    await redis.set(otpRequestKey, otpRequests + 1, "EX", 3600);
};

export const sendOtp = async (
    name: string,
    email: string,
    template: string
) => {
    const otp = crypto.randomInt(100000, 999999).toString();
    await sendEmail(email, "Your OTP Code", template, { name, otp });
    await redis.set(`otp:${email}`, otp, "EX", 300);
    await redis.set(`otp_cooldown:${email}`, "true", "EX", 60);

};

export const verifyOtp = async (
    email: string,
    otp: string,
    next: NextFunction
) => {
    const storedOtp = await redis.get(`otp:${email}`);
    if (!storedOtp) {
        throw new ValidationError("Invalid or expired OTP. Please request a new one.");
    }

    const failedAttemptsKey = `otp_attempts:${email}`;
    const failedAttempts = parseInt((await redis.get(failedAttemptsKey)) || "0");

    if (storedOtp !== otp) {
        if (failedAttempts >= 4) {
            await redis.set(`otp_lock:${email}`, "locked", "EX", 1800);
            await redis.del(`otp:${email}`, failedAttemptsKey);
            throw new ValidationError(
                "Too many incorrect OTP attempts. Please try again after 30 minutes."
            );
        }
        await redis.set(failedAttemptsKey, failedAttempts + 1, "EX", 300);
        throw new ValidationError("Incorrect OTP. Please try again."

        )
    }

    await redis.del(`otp:${email}`, failedAttemptsKey);
};

export const handleForgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
    userType: "user" | "seller"
) => {
    try {
        const { email } = req.body;

        if (!email) throw new ValidationError("Email is required");

        const user =
            userType === "user"
                ? await prisma.users.findUnique({ where: { email } })
                : await prisma.sellers.findUnique({ where: { email } });

        if (!user) throw new ValidationError(`${userType} not found`);

        await checkOtpRestrictions(email, next);
        await trackOtpRequests(email, next);

        await sendOtp(
            user.name,
            email,
            userType === "user"
                ? "forgot-password-user-mail"
                : "forgot-password-seller-mail");

        res.status(200).json({ message: "OTP sent to email,Please verify your account" });
    } catch (error) {
        next(error);
    }
};

export const verifyForgotPasswordOtp = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp)
            throw new ValidationError("Email and OTP are required");
        await verifyOtp(email, otp, next);
        res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
        next(error);
    }
};

