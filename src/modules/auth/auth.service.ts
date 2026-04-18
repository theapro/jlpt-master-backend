import jwt, { type SignOptions } from "jsonwebtoken";

import type { AdminJwtPayload } from "./auth.types";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
};

const getJwtExpiresIn = (): SignOptions["expiresIn"] => {
  const raw = process.env.JWT_EXPIRES_IN;
  if (!raw) return "7d";

  const maybeNumber = Number(raw);
  if (!Number.isNaN(maybeNumber) && raw.trim() !== "") return maybeNumber;
  return raw as SignOptions["expiresIn"];
};

export const signAdminToken = (payload: AdminJwtPayload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiresIn() });
};

export const verifyAdminToken = (token: string): AdminJwtPayload => {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded !== "object" || decoded === null)
    throw new Error("Invalid token");
  const { adminId, role } = decoded as Partial<AdminJwtPayload>;
  if (typeof adminId !== "number" || !role) throw new Error("Invalid token");
  return { adminId, role } as AdminJwtPayload;
};
