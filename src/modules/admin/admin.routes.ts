import { Router } from "express";
import { AdminRole } from "@prisma/client";

import { requireAdminAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { botButtonController } from "../bot/bot-button.controller";
import { botTextController } from "../bot/bot-text.controller";
import { adminController } from "./admin.controller";

const router = Router();

router.post("/login", adminController.login);

router.post("/password-reset/request", adminController.requestPasswordReset);
router.post("/password-reset/confirm", adminController.confirmPasswordReset);

router.post("/google/login", adminController.googleLogin);

router.post(
  "/reply",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  adminController.reply,
);

router.get(
  "/dashboard",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  adminController.dashboard,
);

router.get(
  "/bot-metrics",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  adminController.botMetrics,
);

router.get(
  "/me",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  adminController.me,
);

router.get(
  "/bot-texts",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botTextController.list,
);

router.get(
  "/bot-texts/:key",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botTextController.getByKey,
);

router.put(
  "/bot-texts/:key",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botTextController.upsert,
);

router.delete(
  "/bot-texts/:key",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botTextController.remove,
);

router.get(
  "/bot-buttons",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botButtonController.list,
);

router.get(
  "/bot-buttons/states",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botButtonController.states,
);

router.get(
  "/bot-buttons/preview",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botButtonController.preview,
);

router.post(
  "/bot-buttons",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botButtonController.create,
);

router.put(
  "/bot-buttons/:id",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botButtonController.update,
);

router.delete(
  "/bot-buttons/:id",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  botButtonController.remove,
);

export const adminRoutes = router;
