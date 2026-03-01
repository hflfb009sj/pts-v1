// Pi Network SDK Type Definitions
// Official Pi SDK v2.0+ for Web Apps

declare global {
  interface Window {
    Pi?: PiSDK;
  }
}

// ========================
// Core SDK Types
// ========================

interface PiUser {
  uid: string;
  username: string;
  roles?: string[];
  permissions?: string[];
  accessToken?: string;
}

interface PiAuthenticationResult {
  user: PiUser;
  accessToken: string;
  walletAddress?: string;
  paymentAddress?: string;
}

interface PiPaymentMetadata {
  [key: string]: any;
}

interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => Promise<void> | void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => Promise<void> | void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: any) => void;
  onIncompletePaymentFound?: (payment: any) => void;
}

interface PiPaymentResult {
  identifier: string;
  transaction?: {
    txid: string;
    verified: boolean;
    _link: string;
  };
  status: 'pending' | 'completed' | 'cancelled' | 'error';
}
interface PiSDK {
  // Initialize the SDK
  init: (config: {
    version: string;
    sandbox: boolean
  }) => void;

  // Authenticate user and request scopes
  authenticate: (
    scopes: ('username' | 'payments' | 'wallet_address' | 'roles')[],
    onIncompletePaymentFound?: (payment: any) => void
  ) => Promise<PiAuthenticationResult>;

  // Create a payment
  createPayment: (
    paymentData: {
      amount: number;
      memo?: string;
      metadata?: PiPaymentMetadata;
      merchantId?: string;
    },
    callbacks: PiPaymentCallbacks
  ) => Promise<PiPaymentResult>;

  // Complete a payment after server approval
  completePayment: (
    paymentId: string,
    txid: string
  ) => Promise<void>;

  // Cancel a payment
  cancelPayment: (
    paymentId: string,
    reason?: string
  ) => Promise<void>;

  // Get user's wallet address
  getWalletAddress?: () => Promise<string>;

  // Logout user
  logout?: () => void;
}

// ========================
// Environment Configuration
// ========================

interface PiEnvironmentConfig {
  appId: string;
  apiKey?: string; sandbox: boolean;
  network: 'Mainnet' | 'Testnet' | 'Developer';
}

export {
  PiSDK,
  PiUser,
  PiAuthenticationResult,
  PiPaymentResult,
  PiPaymentCallbacks,
  PiPaymentMetadata,
  PiEnvironmentConfig
};