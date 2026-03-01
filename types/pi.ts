export interface PiUser {
    uid: string;
    username: string;
}

export interface PiAuthenticationResult {
    accessToken: string;
    user: PiUser;
}

export interface PiPaymentCallbacks {
    onReadyForServerApproval: (paymentId: string) => Promise<void> | void;
    onReadyForServerCompletion: (paymentId: string, txid: string) => Promise<void> | void;
    onCancel: (paymentId: string) => void;
    onError: (error: Error, payment?: any) => void;
}

export interface PiSDK {
    init: (config: { version: string; sandbox: boolean }) => void;
    authenticate: (
        scopes: string[],
        onIncompletePaymentFound?: (payment: any) => void
    ) => Promise<PiAuthenticationResult>;
    createPayment: (
        paymentData: {
            amount: number;
            memo: string;
            metadata: Object;
        },
        callbacks: PiPaymentCallbacks
    ) => void;
}
