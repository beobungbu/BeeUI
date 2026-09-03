module.exports = ({ config }) => {
  const baseUrl = process.env.BEEUI_PUBLIC_BASE_URL;
  return {
    ...config,
    experiments: {
      ...(config.experiments || {}),
      ...(baseUrl ? { baseUrl } : {}),
    },
  };
};
