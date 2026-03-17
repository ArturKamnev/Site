import "dotenv/config";

const required = ["JWT_SECRET", "DATABASE_URL"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env variable: ${key}`);
  }
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
  DATABASE_URL: process.env.DATABASE_URL as string,
  DATABASE_SSL: process.env.DATABASE_SSL === "true",
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
