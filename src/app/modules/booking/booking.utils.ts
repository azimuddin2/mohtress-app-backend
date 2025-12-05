// Helper: convert current time → minutes

export const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};
