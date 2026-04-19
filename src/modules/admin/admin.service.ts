import bcrypt from "bcrypt";
import { AdminRole, MessageSender } from "@prisma/client";
import axios from "axios";
import { createHash, randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";

import {
  AppError,
  isNonEmptyString,
  normalizeString,
} from "../../shared/utils";
import { signAdminToken } from "../auth/auth.service";
import { messageService } from "../message/message.service";
import { supportRepository } from "../bot/support.repository";
import { userRepository } from "../user/user.repository";
import { telegramSender } from "../../telegram/telegram.sender";
import { prisma } from "../../shared/prisma";
import { adminRepository } from "./admin.repository";

const invalidCreds = () => new AppError(401, "Invalid email or password");

const getAdminPanelUrl = () => {
  const raw =
    process.env.ADMIN_PANEL_URL ??
    process.env.ADMIN_PANEL_BASE_URL ??
    process.env.FRONTEND_URL ??
    "";

  if (!raw || raw.trim().length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_PANEL_URL is not set");
    }
    return "http://localhost:3001";
  }

  return raw.replace(/\/+$/, "");
};

const getResendApiKey = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.trim().length === 0) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return key;
};

const getResendFromEmail = () => {
  const from =
    process.env.RESEND_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    process.env.MAIL_FROM ??
    "";

  if (from && from.trim().length > 0) return from.trim();

  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_FROM_EMAIL is not set");
  }

  // Works for development/testing in Resend, but should be overridden in prod.
  return "onboarding@resend.dev";
};

const sendEmailViaResend = async (params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) => {
  const apiKey = getResendApiKey();
  const from = getResendFromEmail();

  try {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      },
    );
  } catch (err) {
    console.error("[ERROR SOURCE]: email.resend");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    throw new AppError(502, "Failed to send email");
  }
};

const generateResetToken = () => {
  const b64 = randomBytes(32).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const hashResetToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

let googleClient: OAuth2Client | null = null;

const getGoogleClientId = () => {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id || id.trim().length === 0)
    throw new Error("GOOGLE_CLIENT_ID is not set");
  return id;
};

const verifyGoogleIdTokenEmail = async (credential: string) => {
  const clientId = getGoogleClientId();
  if (!googleClient) googleClient = new OAuth2Client(clientId);

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const emailVerified = payload?.email_verified;

    if (typeof email !== "string" || email.trim().length === 0) {
      throw new AppError(401, "Invalid Google credential");
    }

    if (emailVerified !== true) {
      throw new AppError(401, "Google email is not verified");
    }

    return email.trim().toLowerCase();
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error("[ERROR SOURCE]: admin.googleLogin.verifyIdToken");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    throw new AppError(401, "Invalid Google credential");
  }
};

const adminRoles = new Set<string>(Object.values(AdminRole));

const parseAdminName = (value: unknown) => {
  if (!isNonEmptyString(value)) throw new AppError(400, "name is required");
  const name = normalizeString(value);
  if (name.length > 100) throw new AppError(400, "name is too long");
  return name;
};

const parseAdminEmail = (value: unknown) => {
  if (!isNonEmptyString(value)) throw new AppError(400, "email is required");
  const email = normalizeString(value).toLowerCase();
  if (email.length > 191) throw new AppError(400, "email is too long");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AppError(400, "Invalid email");
  return email;
};

const parseAdminPassword = (value: unknown) => {
  if (!isNonEmptyString(value)) throw new AppError(400, "password is required");
  const password = String(value);
  if (password.length < 8) throw new AppError(400, "password is too short");
  if (password.length > 200) throw new AppError(400, "password is too long");
  return password;
};

const parseAdminRole = (value: unknown): AdminRole => {
  if (!isNonEmptyString(value)) return AdminRole.admin;
  const role = normalizeString(value);
  if (!adminRoles.has(role)) throw new AppError(400, "Invalid role");
  return role as AdminRole;
};

const parseAdminRoleOptional = (value: unknown): AdminRole | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isNonEmptyString(value)) throw new AppError(400, "Invalid role");
  return parseAdminRole(value);
};

const parseTelegramId = (value: unknown) => {
  const raw =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value
        : "";

  if (!isNonEmptyString(raw)) throw new AppError(400, "telegramId is required");

  const telegramId = normalizeString(raw);
  if (telegramId.length > 64) throw new AppError(400, "telegramId is too long");
  if (!/^\d+$/.test(telegramId))
    throw new AppError(400, "telegramId must be numeric");

  return telegramId;
};

const sanitizeOutboundText = (value: unknown) => {
  if (!isNonEmptyString(value)) throw new AppError(400, "message is required");

  const normalized = normalizeString(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length === 0) throw new AppError(400, "message is required");
  return normalized.length > 3500 ? normalized.slice(0, 3500) : normalized;
};

export const adminService = {
  getDashboard: async () => {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    const daysAgo = (days: number) => {
      const d = new Date(startOfToday);
      d.setUTCDate(d.getUTCDate() - days);
      return d;
    };

    const start90d = daysAgo(89);
    const start30d = daysAgo(29);
    const start60d = daysAgo(59);
    const start7d = daysAgo(6);
    const start14d = daysAgo(13);

    const [
      totalUsers,
      totalCourses,
      openSupportRequests,
      unreadMessages,
      newUsers30d,
      prevUsers30d,
      newMessages7d,
      prevMessages7d,
      newSupport7d,
      prevSupport7d,
      users90d,
      messages90d,
      latestSupportRequests,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.supportRequest.count({
        where: { status: { in: ["pending", "active"] } },
      }),
      prisma.message.count({
        where: { sender: MessageSender.user, isRead: false },
      }),
      prisma.user.count({ where: { createdAt: { gte: start30d } } }),
      prisma.user.count({
        where: { createdAt: { gte: start60d, lt: start30d } },
      }),
      prisma.message.count({
        where: { sender: MessageSender.user, createdAt: { gte: start7d } },
      }),
      prisma.message.count({
        where: {
          sender: MessageSender.user,
          createdAt: { gte: start14d, lt: start7d },
        },
      }),
      prisma.supportRequest.count({ where: { createdAt: { gte: start7d } } }),
      prisma.supportRequest.count({
        where: { createdAt: { gte: start14d, lt: start7d } },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: start90d } },
        select: { createdAt: true },
      }),
      prisma.message.findMany({
        where: { sender: MessageSender.user, createdAt: { gte: start90d } },
        select: { createdAt: true },
      }),
      prisma.supportRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          telegramId: true,
          status: true,
          createdAt: true,
          user: { select: { name: true, goal: true } },
        },
      }),
    ]);

    const pctDelta = (current: number, prev: number) => {
      if (!Number.isFinite(current) || !Number.isFinite(prev)) return null;
      if (prev <= 0) return current > 0 ? 100 : 0;
      return ((current - prev) / prev) * 100;
    };

    const dateKey = (d: Date) => d.toISOString().slice(0, 10);

    const bucketCounts = (items: Array<{ createdAt: Date }>) => {
      const map = new Map<string, number>();
      for (const it of items) {
        const key = dateKey(it.createdAt);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return map;
    };

    const usersByDay = bucketCounts(users90d);
    const messagesByDay = bucketCounts(messages90d);

    const chartData: Array<{ date: string; users: number; messages: number }> =
      [];
    for (let i = 0; i < 90; i++) {
      const d = new Date(start90d);
      d.setUTCDate(d.getUTCDate() + i);
      const key = dateKey(d);
      chartData.push({
        date: key,
        users: usersByDay.get(key) ?? 0,
        messages: messagesByDay.get(key) ?? 0,
      });
    }

    const tableData = latestSupportRequests.map((r) => {
      const who = r.user?.name
        ? `${r.user.name} (${r.telegramId})`
        : r.telegramId;
      const target = r.user?.goal ? String(r.user.goal) : "—";
      const status = r.status === "closed" ? "Done" : "In Process";

      return {
        id: r.id,
        header: `Support #${r.id} — ${who}`,
        type: "Support",
        status,
        target,
        limit: dateKey(r.createdAt),
        reviewer: "Assign reviewer",
      };
    });

    return {
      stats: {
        totalUsers,
        totalCourses,
        openSupportRequests,
        unreadMessages,
        newUsers30d,
        newUsers30dDeltaPct: pctDelta(newUsers30d, prevUsers30d),
        newMessages7d,
        newMessages7dDeltaPct: pctDelta(newMessages7d, prevMessages7d),
        newSupportRequests7d: newSupport7d,
        newSupportRequests7dDeltaPct: pctDelta(newSupport7d, prevSupport7d),
      },
      chartData,
      tableData,
    };
  },

  login: async (emailRaw: unknown, passwordRaw: unknown) => {
    if (!isNonEmptyString(emailRaw) || !isNonEmptyString(passwordRaw))
      throw invalidCreds();

    const email = normalizeString(emailRaw).toLowerCase();
    const password = String(passwordRaw);

    const admin = await adminRepository.findForLoginByEmail(email);
    if (!admin) throw invalidCreds();

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) throw invalidCreds();

    const token = signAdminToken({ adminId: admin.id, role: admin.role });

    return {
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    };
  },

  requestPasswordReset: async (emailRaw: unknown) => {
    const email = parseAdminEmail(emailRaw);

    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    // Avoid account enumeration.
    if (!admin) return { ok: true };

    const token = generateResetToken();
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.adminPasswordResetToken.deleteMany({
      where: { adminId: admin.id },
    });

    const created = await prisma.adminPasswordResetToken.create({
      data: {
        adminId: admin.id,
        tokenHash,
        expiresAt,
      },
      select: { id: true },
    });

    const resetUrl = `${getAdminPanelUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = "Reset your JLPT Master admin password";
    const safeName = escapeHtml(admin.name);
    const text = `Hello ${admin.name},\n\nWe received a request to reset your admin password.\n\nReset link (valid for 60 minutes):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`;
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f7f9;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Password reset link for your admin account.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f7f9;padding:24px 12px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:22px 22px 0 22px;font-size:18px;font-weight:700;color:#111827;">
                JLPT Master — Password reset
              </td>
            </tr>
            <tr>
              <td style="padding:14px 22px 0 22px;font-size:14px;color:#374151;">
                Hello ${safeName},
              </td>
            </tr>
            <tr>
              <td style="padding:10px 22px 0 22px;font-size:14px;color:#374151;">
                We received a request to reset your admin password. This link is valid for <strong>60 minutes</strong>.
              </td>
            </tr>
            <tr>
              <td style="padding:18px 22px 0 22px;">
                <a href="${resetUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px;">
                  Reset password
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 22px 0 22px;font-size:12px;color:#6b7280;">
                If the button doesn't work, copy and paste this URL into your browser:
                <div style="word-break:break-all;margin-top:6px;">
                  <a href="${resetUrl}" style="color:#111827;text-decoration:underline;">${resetUrl}</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 22px 22px 22px;font-size:12px;color:#6b7280;">
                If you didn't request a password reset, you can safely ignore this email.
              </td>
            </tr>
          </table>
          <div style="max-width:520px;margin-top:12px;font-size:12px;color:#9ca3af;text-align:center;">
            © ${new Date().getUTCFullYear()} JLPT Master
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    try {
      await sendEmailViaResend({
        to: admin.email,
        subject,
        html,
        text,
      });
    } catch (err) {
      try {
        await prisma.adminPasswordResetToken.delete({
          where: { id: created.id },
        });
      } catch {
        // ignore cleanup errors
      }
      throw err;
    }

    return { ok: true };
  },

  confirmPasswordReset: async (tokenRaw: unknown, newPasswordRaw: unknown) => {
    if (!isNonEmptyString(tokenRaw))
      throw new AppError(400, "reset token is required");

    const token = normalizeString(String(tokenRaw));
    if (token.length > 500) throw new AppError(400, "reset token is too long");

    const newPassword = parseAdminPassword(newPasswordRaw);
    const tokenHash = hashResetToken(token);

    const record = await prisma.adminPasswordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        adminId: true,
        expiresAt: true,
        usedAt: true,
        admin: { select: { id: true, role: true } },
      },
    });

    const now = new Date();
    if (!record || record.usedAt !== null || record.expiresAt <= now) {
      throw new AppError(400, "Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.admin.update({
        where: { id: record.adminId },
        data: { password: passwordHash },
      }),
      prisma.adminPasswordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      prisma.adminPasswordResetToken.deleteMany({
        where: { adminId: record.adminId, id: { not: record.id } },
      }),
    ]);

    return { ok: true };
  },

  googleLogin: async (credentialRaw: unknown) => {
    if (!isNonEmptyString(credentialRaw))
      throw new AppError(400, "credential is required");

    const credential = normalizeString(String(credentialRaw));
    if (credential.length > 10_000)
      throw new AppError(400, "credential is too long");

    const email = await verifyGoogleIdTokenEmail(credential);

    const admin = await adminRepository.findByEmail(email);
    if (!admin) throw new AppError(401, "Unauthorized");

    const token = signAdminToken({ adminId: admin.id, role: admin.role });
    return { token, admin };
  },

  listAdmins: async () => {
    const admins = await adminRepository.findAll();
    return { admins };
  },

  createAdmin: async (body: any) => {
    const name = parseAdminName(body?.name);
    const email = parseAdminEmail(body?.email);
    const password = parseAdminPassword(body?.password);
    const role = parseAdminRole(body?.role);

    const existing = await adminRepository.findByEmail(email);
    if (existing) throw new AppError(409, "Admin already exists");

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await adminRepository.create({
      name,
      email,
      password: passwordHash,
      role,
    });

    return { admin };
  },

  getAdminById: async (id: number) => {
    const admin = await adminRepository.findById(id);
    if (!admin) throw new AppError(404, "Admin not found");
    return { admin };
  },

  updateAdmin: async (id: number, body: any) => {
    const existing = await adminRepository.findById(id);
    if (!existing) throw new AppError(404, "Admin not found");

    const data: {
      name?: string;
      email?: string;
      role?: AdminRole;
      password?: string;
    } = {};

    if (body?.name !== undefined) data.name = parseAdminName(body.name);

    if (body?.email !== undefined) {
      const email = parseAdminEmail(body.email);
      if (email !== existing.email) {
        const emailOwner = await adminRepository.findByEmail(email);
        if (emailOwner && emailOwner.id !== existing.id)
          throw new AppError(409, "Email is already in use");
      }
      data.email = email;
    }

    const role = parseAdminRoleOptional(body?.role);
    if (role) data.role = role;

    const passwordRaw = body?.password;
    if (typeof passwordRaw === "string" && passwordRaw.trim().length > 0) {
      const password = parseAdminPassword(passwordRaw);
      data.password = await bcrypt.hash(password, 12);
    }

    if (Object.keys(data).length === 0)
      throw new AppError(400, "No fields to update");

    const admin = await adminRepository.updateById(id, data);
    return { admin };
  },

  deleteAdmin: async (actor: { id: number; role: AdminRole }, id: number) => {
    if (actor.role !== AdminRole.super_admin) {
      throw new AppError(403, "Forbidden");
    }

    const existing = await adminRepository.findById(id);
    if (!existing) throw new AppError(404, "Admin not found");

    if (existing.id === actor.id) {
      throw new AppError(400, "You cannot delete your own account");
    }

    if (existing.role === AdminRole.super_admin) {
      const superAdminCount = await adminRepository.countByRole(
        AdminRole.super_admin,
      );
      if (superAdminCount <= 1) {
        throw new AppError(400, "Cannot delete the last super admin");
      }
    }

    const admin = await adminRepository.deleteById(id);
    return { admin };
  },

  replyToUser: async (adminId: number, body: any) => {
    const telegramId = parseTelegramId(body?.telegramId);
    const text = sanitizeOutboundText(body?.message);

    const user = await userRepository.findByTelegramId(telegramId);
    if (!user) throw new AppError(404, "User not found");

    try {
      if (user.supportAdminId === null) {
        await userRepository.updateByTelegramId(telegramId, {
          supportAdminId: adminId,
        });
      }
    } catch {
      // ignore assignment errors
    }

    const chatId = Number(telegramId);
    if (!Number.isFinite(chatId) || chatId <= 0)
      throw new AppError(400, "Invalid telegramId");

    let telegramMessageId: number | null = null;

    try {
      const sent = await telegramSender.sendMessage(chatId, text);
      telegramMessageId =
        typeof (sent as any)?.message_id === "number"
          ? (sent as any).message_id
          : null;
    } catch (err) {
      console.error("[ERROR SOURCE]: admin.service.replyToUser.telegram");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      throw new AppError(502, "Failed to send Telegram message");
    }

    const saved = await messageService.createAdminMessage({
      telegramId,
      text,
      telegramMessageId,
    });

    try {
      await userRepository.updateSupportStatusByTelegramId(
        telegramId,
        "active",
      );
    } catch {
      // ignore status update errors
    }

    try {
      const req =
        await supportRepository.findLatestOpenByTelegramId(telegramId);
      if (!req) {
        await supportRepository.createRequest(telegramId, "active");
      } else if (req.status === "pending") {
        await supportRepository.setStatusById(req.id, "active");
      }
    } catch {
      // ignore request update errors
    }

    return { message: saved };
  },
};
