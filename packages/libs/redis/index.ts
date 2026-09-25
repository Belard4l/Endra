import Redis from "ioredis";

if (!process.env.REDIS_DATABASE_URI) {
  console.warn("[redis] REDIS_DATABASE_URI is not set — OTPs, locks and caching will fail");
}

const redis = new Redis(process.env.REDIS_DATABASE_URI || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
});

redis.on("error", (err) => console.error("[redis]", err.message));

/** Short-lived lock (used to stop two couples booking the same slot at once) */
export const withLock = async <T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> => {
  const token = `${Date.now()}-${Math.random()}`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const ok = await redis.set(`lock:${key}`, token, "EX", ttlSeconds, "NX");
    if (ok) {
      try {
        return await fn();
      } finally {
        const current = await redis.get(`lock:${key}`);
        if (current === token) await redis.del(`lock:${key}`);
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("This date is being booked by someone else right now. Please try again in a moment.");
};

export default redis;
