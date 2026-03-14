export interface PiUser {
  uid: string;
  username: string;
}

export interface PiAuthenticationResult {
  accessToken: string;
  user: PiUser;
}

export interface PiSDK {
  init(config: { version: string; sandbox: boolean }): void;
  authenticate(scopes: string[], onIncompletePaymentFound: (payment: any) => void, onSuccess?: (auth: PiAuthenticationResult) => void): Promise<PiAuthenticationResult>;
  createPayment(data: any, callbacks: any): void;
}
