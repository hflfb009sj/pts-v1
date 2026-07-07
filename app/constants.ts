// app/constants.ts
// PTrust Oracle — Global Configuration
// Version 2.0.0 — Updated July 2026

export const ORACLE_CONFIG = {
  NAME:    'PTrust Oracle',
  SLOGAN:  'Lock funds · verify delivery · release with confidence',
  VERSION: '2.0.0',

  // ── Commission Settings ──────────────────────────────────────────────────
  COMMISSION_WALLET:      'GBXO3576YTVHKCJHRRUSQEKB4YQFBQALTPO2ETG5XQDOI62HJLUON7IT',
  ESCROW_WALLET:          'GCIOA66BURNEIRIPVCPD7TXY7RIW46YHGTWIM44S620JHV3S3LNNZHML',
  SERVICE_FEE_PERCENTAGE: 0.1,   // 0.1% fee (not 1%)
  SERVICE_FEE_DECIMAL:    0.001, // use this in calculations

  // ── Transaction Limits ───────────────────────────────────────────────────
  MIN_TRANSACTION: 0.000001, // Minimum 0.000001 Pi (micro-transactions)
  MAX_TRANSACTION: 1000000,  // Maximum 1,000,000 Pi

  // ── Timeouts ─────────────────────────────────────────────────────────────
  AUTO_RELEASE_DAYS:   15, // Auto-release to seller after 15 days of silence
  DISPUTE_WINDOW_DAYS: 15, // Evidence window after dispute opened
  DELAY_WARNING_DAYS:  3,  // Show delay warning after 3 days without delivery

  // ── KYC Threshold ────────────────────────────────────────────────────────
  KYC_REQUIRED_ABOVE: 100, // KYC confirmation required for deals > 100 Pi

  // ── Network ──────────────────────────────────────────────────────────────
  NETWORK:   'Pi Network Mainnet',
  CURRENCY:  'π',
  APP_URL:   'https://pts-v1.vercel.app',
  PINET_URL: 'https://ptrust2837.pinet.com',
  SUPPORT:   'Riahig45@gmail.com',
  ADMIN:     'GhaithriAHI96',

  // ── API Endpoints ─────────────────────────────────────────────────────────
  ENDPOINTS: {
    CREATE:       '/api/escrow/create',
    FINALIZE:     '/api/escrow/finalize',
    RELEASE:      '/api/escrow/release',
    DISPUTE:      '/api/escrow/dispute',
    EVIDENCE:     '/api/escrow/evidence',
    ACCEPT:       '/api/escrow/accept',
    COMPLETE:     '/api/escrow/complete',
    RATE:         '/api/escrow/rate',
    TRANSACTIONS: '/api/escrow/transactions',
    TRANSACTION:  '/api/escrow/transaction',
    ADMIN:        '/api/admin',
    MESSAGES:     '/api/messages',
    AUTH:         '/api/auth/pi',
  },
} as const;

export type OracleConfig = typeof ORACLE_CONFIG;
