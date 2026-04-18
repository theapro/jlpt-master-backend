import { Router } from "express";
import { AdminRole } from "@prisma/client";

import { requireAdminAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { goalController } from "./goal.controller";

const router = Router();

router.post(
  "/",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  goalController.create,
);

router.get("/", goalController.getAll);
router.get("/:id", goalController.getById);

router.patch(
  "/:id",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  goalController.update,
);

router.delete(
  "/:id",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  goalController.remove,
);

export const goalRoutes = router;
