import { Router } from "express";
import { AdminRole } from "@prisma/client";

import { requireAdminAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { enrollmentController } from "./enrollment.controller";

const router = Router();

router.post(
  "/assign",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  enrollmentController.assign,
);

export const enrollmentRoutes = router;
