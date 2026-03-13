export type EscrowStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DELIVERED'
  | 'CONFIRMED'
  | 'FROZEN'
  | 'UNDER_REVIEW'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'PENDING_ADMIN'
  | 'EXPIRED';

export interface AuditEntry {
  action: string;
  by: string;
  at: Date;
  note: string;
}

export interface DisputeEvidence {
  submittedBy: string;
  type: 'text' | 'url';
  content: string;
  submittedAt: Date;
}

export interface JudgeVote {
  judgeUsername: string;
  vote: 'SELLER' | 'BUYER';
  votedAt: Date;
  reasoning?: string;
}

export interface Transaction {
  _id?: string;
  transactionNumber: string;
  escrowCode: string;
  buyerKey: string;
  sellerKey: string;
  paymentId?: string;
  txid?: string;
  sellerWallet: string;
  buyerUsername: string;
  sellerUsername?: string;
  amount: number;
  fee: number;
  description: string;
  status: EscrowStatus;
  releaseAttempts: number;
  buyerKeyAttempts: number;
  sellerKeyAttempts: number;
  sellerTxHash?: string;
  commissionTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  deliveredAt?: Date;
  frozenAt?: Date;
  releasedAt?: Date;
  disputeId?: string;
  rating?: number;
  auditLog: AuditEntry[];
}