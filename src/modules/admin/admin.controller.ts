import type { RequestHandler } from "express";

import { asyncHandler, AppError, parsePositiveInt } from "../../shared/utils";
import { perfMetrics } from "../../shared/perf-metrics";
import { adminService } from "./admin.service";

export const adminController = {
  login: asyncHandler(async (req, res) => {
    const result = await adminService.login(
      req.body?.email,
      req.body?.password,
    );
    res.status(200).json(result);
  }) as RequestHandler,

  dashboard: asyncHandler(async (req, res) => {
    const result = await adminService.getDashboard();
    res.status(200).json(result);
  }) as RequestHandler,

  listAdmins: asyncHandler(async (_req, res) => {
    const result = await adminService.listAdmins();
    res.status(200).json(result);
  }) as RequestHandler,

  createAdmin: asyncHandler(async (req, res) => {
    const result = await adminService.createAdmin(req.body);
    res.status(201).json(result);
  }) as RequestHandler,

  getAdminById: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid admin id");
    const result = await adminService.getAdminById(id);
    res.status(200).json(result);
  }) as RequestHandler,

  updateAdmin: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid admin id");
    const result = await adminService.updateAdmin(id, req.body);
    res.status(200).json(result);
  }) as RequestHandler,

  reply: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const result = await adminService.replyToUser(req.admin.id, req.body);
    res.status(200).json(result);
  }) as RequestHandler,

  me: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const result = await adminService.getAdminById(req.admin.id);
    res.status(200).json(result);
  }) as RequestHandler,

  botMetrics: asyncHandler(async (req, res) => {
    const report = perfMetrics.getReport({
      windowSec: req.query?.windowSec,
      seriesMetric:
        (req.query as any)?.seriesMetric ?? (req.query as any)?.metric,
    });
    res.status(200).json(report);
  }) as RequestHandler,
};
