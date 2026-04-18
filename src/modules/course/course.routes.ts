import { Router } from "express";
import { AdminRole } from "@prisma/client";

import { requireAdminAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { courseController } from "./course.controller";

const router = Router();

router.post(
  "/",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  courseController.create,
);

router.get("/", courseController.getAll);
router.get("/:id", courseController.getById);

router.patch(
  "/:id",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  courseController.update,
);

router.delete(
  "/:id",
  requireAdminAuth,
  requireRole(AdminRole.admin, AdminRole.super_admin),
  courseController.remove,
);

export const courseRoutes = router;
