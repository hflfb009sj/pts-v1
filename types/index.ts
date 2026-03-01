export enum EscrowStatus {
    PENDING = 'PENDING',
    LOCKED = 'LOCKED',
    RELEASED = 'RELEASED',
    DISPUTED = 'DISPUTED',
    REFUNDED = 'REFUNDED',
}

export interface EscrowTransaction {
    id: string;
    amount: number;
    sender: string;
    recipient: string;
    status: EscrowStatus;
    timestamp: number;
}
