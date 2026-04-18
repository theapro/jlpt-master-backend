export type UserState = {
  awaitingPhone?: boolean;
  awaitingQuestion?: boolean;
};

const userState = new Map<string, UserState>();

export const stateService = {
  get: (telegramId: string): UserState => userState.get(telegramId) ?? {},

  patch: (telegramId: string, patch: Partial<UserState>) => {
    const current = userState.get(telegramId) ?? {};
    const next = { ...current, ...patch };
    userState.set(telegramId, next);
    return next;
  },

  clear: (telegramId: string) => {
    userState.delete(telegramId);
  },
};
