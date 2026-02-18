export const getCurrentWeekRange = () => {
  const now = new Date();

  // UTC day (0 = Sunday)
  const day = now.getUTCDay();

  // Go back to Sunday
  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - day,
      0,
      0,
      0,
      0,
    ),
  );

  const endDate = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate() + 6,
      23,
      59,
      59,
      999,
    ),
  );

  return { startDate, endDate };
};
