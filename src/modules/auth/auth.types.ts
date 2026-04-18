import type { AdminRole } from "@prisma/client";

export type AdminJwtPayload = {
  adminId: number;
  role: AdminRole;
};
