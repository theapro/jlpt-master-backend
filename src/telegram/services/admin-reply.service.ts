const adminReplyTargets = new Map<number, string>();

export const adminReplyService = {
  setTarget: (adminTelegramId: number, userTelegramId: string) => {
    adminReplyTargets.set(adminTelegramId, userTelegramId);
  },

  getTarget: (adminTelegramId: number) => {
    return adminReplyTargets.get(adminTelegramId) ?? null;
  },

  clearTarget: (adminTelegramId: number) => {
    adminReplyTargets.delete(adminTelegramId);
  },
};
