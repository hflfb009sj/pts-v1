export const PI_NETWORK_CONFIG = {
    SDK_URL: 'https://sdk.minepi.com/pi-sdk.js',
    SANDBOX: process.env.PI_SANDBOX === 'false' ? false : true,
    API_BASE: 'https://api.minepi.com',
    SCOPES: ['username', 'payments', 'wallet_address'],
} as const;

export const BACKEND_URLS = {
    LOGIN: '/api/auth/login',
    LOGIN_PREVIEW: '/api/auth/login-preview',
    CHAT: '/api/chat',
} as const;