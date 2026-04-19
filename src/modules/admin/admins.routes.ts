import { Router } from "express";
import { AdminRole } from "@prisma/client";

import { requireAdminAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { adminController } from "./admin.controller";

const router = Router();

router.get(
  "/",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  adminController.listAdmins,
);

router.post(
  "/",
  requireAdminAuth,
  requireRole(AdminRole.super_admin),
  adminController.createAdmin,
);

router.get(
  "/:id",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  adminController.getAdminById,
);

router.patch(
  "/:id",
  requireAdminAuth,
  requireRole(AdminRole.super_admin),
  adminController.updateAdmin,
);

router.delete(
  "/:id",
  requireAdminAuth,
  requireRole(AdminRole.super_admin),
  adminController.deleteAdmin,
);

export const adminsRoutes = router;
