import express from "express";
import cors from "cors";

import { errorMiddleware } from "./middlewares/error.middleware";
import { requestLoggerMiddleware } from "./middlewares/request-logger.middleware";
import { userRoutes } from "./modules/user/user.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { adminsRoutes } from "./modules/admin/admins.routes";
import { courseRoutes } from "./modules/course/course.routes";
import { enrollmentRoutes } from "./modules/enrollment/enrollment.routes";
import { goalRoutes } from "./modules/goal/goal.routes";
import { botRoutes } from "./modules/bot/bot.routes";
import { messageRoutes } from "./modules/message/message.routes";
import { supportRoutes } from "./modules/support/support.routes";
import { telegramWebhookRoutes } from "./telegram/webhook.routes";

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsCredentials =
  process.env.CORS_CREDENTIALS === "1" ||
  String(process.env.CORS_CREDENTIALS ?? "").toLowerCase() === "true";

app.use(
  cors({
    origin:
      corsOrigins.length > 0
        ? corsOrigins
        : process.env.NODE_ENV === "production"
          ? false
          : true,
    credentials: corsCredentials,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use(requestLoggerMiddleware);

app.use(telegramWebhookRoutes);

app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admins", adminsRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/bot", botRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

app.use(errorMiddleware);

export default app;
