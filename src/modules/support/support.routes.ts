import { Router } from "express";
import { AdminRole } from "@prisma/client";

import { requireAdminAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { supportController } from "./support.controller";

const router = Router();

router.patch(
  "/:id/status",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  supportController.updateStatus,
);

export const supportRoutes = router;
