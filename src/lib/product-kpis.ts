export const PRIORITY_KPIS = {
  activation: {
    metric: "Users adding 3 transactions + 1 investment in 24h",
    target: 55,
  },
  retentionD30: {
    metric: "D30 retention after enabling at least one alert",
    target: 35,
  },
  dataFreshness: {
    metric: "Holdings with price updated in last 24h",
    target: 95,
  },
} as const;

