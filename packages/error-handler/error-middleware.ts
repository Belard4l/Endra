import { AppError } from "./index";
import { NextFunction, Request, Response } from "express";

export const errorMiddleware = (err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    console.log(`Error ${req.method} ${req.url} - ${err.message}`);
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Price/option validation errors from @packages/utils/pricing
  if (err?.constructor?.name === "PricingError") {
    return res.status(400).json({ status: "error", message: err.message });
  }

  // Prisma unique constraint
  if (err?.code === "P2002") {
    return res.status(409).json({ status: "error", message: "This record already exists." });
  }
  // Prisma invalid ObjectId / record not found
  if (err?.code === "P2023" || err?.code === "P2025") {
    return res.status(404).json({ status: "error", message: "Record not found." });
  }

  // Lock contention and other plain errors meant for the user
  if (typeof err?.message === "string" && err.message.startsWith("This date is being booked")) {
    return res.status(409).json({ status: "error", message: err.message });
  }

  console.error("Unexpected Error: ", err);
  return res.status(500).json({
    status: "error",
    message: "Something went wrong. Please try again later.",
  });
};
