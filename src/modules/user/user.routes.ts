import { Router } from "express";
import { AdminRole } from "@prisma/client";

import { requireAdminAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { userController } from "./user.controller";

const router = Router();

router.post("/register", userController.register);

router.get(
  "/",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  userController.listForAdmin,
);

router.get(
  "/:id",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  userController.getByIdForAdmin,
);

router.patch(
  "/:id/support-status",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  userController.updateSupportStatusForAdmin,
);

export const userRoutes = router;
