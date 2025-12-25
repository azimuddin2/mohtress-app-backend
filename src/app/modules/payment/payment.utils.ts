export const generateTrxId = () => {
  const prefix = 'trx_';
  const randomString =
    Math.random().toString(36).substring(2, 12) +
    Math.random().toString(36).substring(2, 12);
  return prefix + randomString;
};
