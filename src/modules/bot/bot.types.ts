export type BotResponse = {
  reply: string;
  buttons: string[][];
  action?: string;
  courses?: BotCourseSummary[];
  course?: BotCourse;
  profile?: BotProfile;
  supportStatus?: SupportStatus;
  adminNotification?: BotAdminNotification;
};

export type BotCourseSummary = {
  id: number;
  title: string;
};

export type BotCourse = {
  id: number;
  title: string;
  description: string;
};

export type BotUserInfo = {
  telegramId: string;
  name: string;
  phone: string | null;
};

export type SupportStatus = "none" | "pending" | "active" | "closed";

export type BotProfile = BotUserInfo & {
  supportStatus: SupportStatus;
};

export type BotAdminNotification =
  | {
      type: "support_request";
      user: BotUserInfo;
      requestId: number | null;
    }
  | {
      type: "support_message";
      user: BotUserInfo;
      requestId: number | null;
      message: string;
    };

export type BotStartBody = {
  telegramId: string;
  name: string;
  telegramUsername?: string | null;
};

export type BotMessageBody = {
  telegramId: string;
  message: string;
  telegramMessageId?: number;
};

export type BotRegisterPhoneBody = {
  telegramId: string;
  phone: string;
  telegramMessageId?: number;
};

export type BotEnrollBody = {
  telegramId: string;
  courseId: number;
};

export type BotAiBody = {
  telegramId: string;
  message: string;
};
