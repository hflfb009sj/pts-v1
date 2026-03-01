// app/constants.ts
// PTrust Oracle - Global Configuration
// Production Grade - Version 1.2.0

export const ORACLE_CONFIG = {
  NAME: "PTrust Oracle",
  SLOGAN: "The Gold Standard of Pi Escrow",
  VERSION: "1.2.0",

  // COMMISSION SETTINGS
  // Your Wallet Address to receive the 1% service fee
  COMMISSION_WALLET: "GBXO3576YTVHKCJHRRUSQEKB4YQFBQALTPO2ETG5XQDOI62HJLUON7IT",
  SERVICE_FEE_PERCENTAGE: 1, // 1% fee

  // TRANSACTION LIMITS
  MIN_TRANSACTION: 1.0,  // Minimum 1 Pi
  MAX_TRANSACTION: 10000, // Maximum 10,000 Pi

  // TIMEOUTS
  ESCROW_TIMEOUT_DAYS: 3,  // Funds auto-release after 3 days if no dispute
  DISPUTE_WINDOW_DAYS: 7,  // Time allowed for dispute resolution

  // NETWORK
  NETWORK: "Pi Network Mainnet",
  CURRENCY: "π",

  // API ROUTES
  ENDPOINTS: {
    APPROVE: "/api/escrow/approve",
    COMPLETE: "/api/escrow/complete",
    CANCEL: "/api/escrow/cancel",
    STATS: "/api/escrow/stats",
  }
} as const;

export type OracleConfig = typeof ORACLE_CONFIG;