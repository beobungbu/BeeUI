module.exports = ({ config }) => {
  const baseUrl = process.env.BEEUI_PUBLIC_BASE_URL;
  const publicStatic = process.env.BEEUI_PUBLIC_STATIC === '1';
  return {
    ...config,
    web: {
      ...(config.web || {}),
      ...(publicStatic ? { output: 'static' } : {}),
    },
    experiments: {
      ...(config.experiments || {}),
      ...(baseUrl ? { baseUrl } : {}),
    },
  };
};
