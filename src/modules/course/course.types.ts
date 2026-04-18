export type CreateCourseBody = {
  title: string;
  description: string;
  duration?: number | null;
  isActive?: boolean;
};
