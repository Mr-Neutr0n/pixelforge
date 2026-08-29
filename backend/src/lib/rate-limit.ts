import { createHmac, createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getPool } from "./db.js";

const GLOBAL_DAILY_LIMIT = 100;
const IP_DAILY_LIMIT = 2;
const MAX_PROVIDER_CALLS_PER_PROJECT = 10;

export class QuotaError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function pepper(): string {
  const value = process.env.IP_HASH_PEPPER?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("IP_HASH_PEPPER is required in production");
  return "pixelforge-development-only-pepper";
}

export function normalizedClientIp(req: Request): string {
  const value = req.ip || req.socket.remoteAddress || "";
  const normalized = value.replace(/^::ffff:/, "").trim();
  if (!normalized || normalized.length > 64 || !/^[0-9a-f:.]+$/i.test(normalized)) {
    throw new QuotaError(400, "Unable to identify client address");
  }
  return normalized;
}

function ipHash(req: Request): string {
  return createHmac("sha256", pepper()).update(normalizedClientIp(req)).digest("hex");
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createGenerationSession(req: Request): Promise<{
  token: string;
  globalRemaining: number;
  ipRemaining: number;
}> {
  const client = await getPool().connect();
  const hashedIp = ipHash(req);
  const token = randomBytes(32).toString("base64url");
  try {
    await client.query("BEGIN");
    const daily = await client.query(
      `INSERT INTO generation_daily (day, total)
       VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 0)
       ON CONFLICT (day) DO UPDATE SET total = generation_daily.total
       RETURNING total`,
    );
    const globalTotal = Number(daily.rows[0].total);
    if (globalTotal >= GLOBAL_DAILY_LIMIT) throw new QuotaError(429, "PixelForge has reached its daily generation limit");

    const perIp = await client.query(
      `INSERT INTO generation_ip_daily (day, ip_hash, total)
       VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, $1, 0)
       ON CONFLICT (day, ip_hash) DO UPDATE SET total = generation_ip_daily.total
       RETURNING total`,
      [hashedIp],
    );
    const ipTotal = Number(perIp.rows[0].total);
    if (ipTotal >= IP_DAILY_LIMIT) throw new QuotaError(429, "This address has reached its daily limit of 2 sprite projects");

    await client.query(
      `UPDATE generation_daily
       SET total = total + 1
       WHERE day = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date`,
    );
    await client.query(
      `UPDATE generation_ip_daily
       SET total = total + 1
       WHERE day = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AND ip_hash = $1`,
      [hashedIp],
    );
    await client.query(
      `INSERT INTO generation_sessions (token_hash, day, ip_hash)
       VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, $2)`,
      [tokenHash(token), hashedIp],
    );
    await client.query("COMMIT");
    return {
      token,
      globalRemaining: GLOBAL_DAILY_LIMIT - globalTotal - 1,
      ipRemaining: IP_DAILY_LIMIT - ipTotal - 1,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function requireGenerationSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.header("x-generation-token")?.trim() || "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new QuotaError(401, "A valid generation session is required");
    const result = await getPool().query(
      `UPDATE generation_sessions
       SET provider_calls = provider_calls + 1
       WHERE token_hash = $1
         AND ip_hash = $2
         AND day = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
         AND provider_calls < $3
       RETURNING provider_calls`,
      [tokenHash(token), ipHash(req), MAX_PROVIDER_CALLS_PER_PROJECT],
    );
    if (!result.rows.length) throw new QuotaError(429, "This sprite project has reached its generation limit");
    res.setHeader("X-PixelForge-Project-Calls-Remaining", String(MAX_PROVIDER_CALLS_PER_PROJECT - Number(result.rows[0].provider_calls)));
    next();
  } catch (error) {
    next(error);
  }
}

export async function quotaStatus(req: Request): Promise<{
  global: { used: number; limit: number; remaining: number };
  client: { used: number; limit: number; remaining: number };
}> {
  const result = await getPool().query(
    `SELECT
       COALESCE((SELECT total FROM generation_daily WHERE day = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date), 0) AS global_total,
       COALESCE((SELECT total FROM generation_ip_daily WHERE day = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AND ip_hash = $1), 0) AS ip_total`,
    [ipHash(req)],
  );
  const globalUsed = Number(result.rows[0].global_total);
  const ipUsed = Number(result.rows[0].ip_total);
  return {
    global: { used: globalUsed, limit: GLOBAL_DAILY_LIMIT, remaining: Math.max(0, GLOBAL_DAILY_LIMIT - globalUsed) },
    client: { used: ipUsed, limit: IP_DAILY_LIMIT, remaining: Math.max(0, IP_DAILY_LIMIT - ipUsed) },
  };
}

export function validateQuotaConfiguration(): void {
  pepper();
}
