import type { EnrollmentStatus } from "@prisma/client";

export type AssignEnrollmentBody = {
  userId: number;
  courseId: number;
  status?: EnrollmentStatus;
};
