import { Router } from "express";
import { AdminRole } from "@prisma/client";

import { requireAdminAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { messageController } from "./message.controller";

const router = Router();

router.get(
  "/users",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  messageController.listUsers,
);

router.get(
  "/chats",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  messageController.listChats,
);

router.post(
  "/send",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  messageController.send,
);

router.patch(
  "/item/:id",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  messageController.editById,
);

router.post(
  "/item/:id/delete",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  messageController.deleteById,
);

router.post(
  "/item/:id/hide",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  messageController.hideById,
);

router.get(
  "/:telegramId",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  messageController.getByTelegramId,
);

export const messageRoutes = router;
