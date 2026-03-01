'use client';

import { ORACLE_CONFIG } from '@/app/constants';

// ========================================
// Type Definitions
// ========================================

export interface EscrowPaymentData {
    amount: number;
    fee: number;
    description: string;
    sellerWallet: string;
    buyerUsername: string;
}

export interface TransactionResult {
    paymentId: string;
    id: string; // For backward compatibility with UI
    status: string;
    txid?: string;
    createdAt: Date;
}

export interface DisputeInput {
    transactionId: string;
    reason: string;
    reporter: string;
}

// Pi SDK Types for full typing
interface PiPaymentData {
    amount: number;
    memo: string;
    metadata: Record<string, any>;
}

interface PiCallbacks {
    onReadyForServerApproval: (paymentId: string) => void;
    onReadyForServerCompletion: (paymentId: string, txid: string) => void;
    onCancel: (paymentId: string) => void;
    onError: (error: Error, paymentId?: string) => void;
}

// ========================================
// Helper Functions
// ========================================

const getPiWindow = () => {
    if (typeof window === 'undefined') return {} as any;
    return window as any;
};

const validateTransaction = (data: EscrowPaymentData) => {
    if (!data.sellerWallet || data.sellerWallet.trim().length === 0) {
        throw new Error('Seller wallet address is required');
    }

    if (data.amount < ORACLE_CONFIG.MIN_TRANSACTION) {
        throw new Error(`Minimum transaction amount is ${ORACLE_CONFIG.MIN_TRANSACTION} π`);
    }
    if (data.amount > ORACLE_CONFIG.MAX_TRANSACTION) {
        throw new Error(`Maximum transaction amount is ${ORACLE_CONFIG.MAX_TRANSACTION} π`);
    }

    if (!data.description || data.description.trim().length === 0) {
        throw new Error('Transaction description is required');
    }
};

// ========================================
// Core Functions - Pi SDK Integration
// ========================================

/**
 * Create a new escrow transaction using Pi SDK
 * This function handles the complete payment flow with Pi Network
 */
export const createEscrowTransaction = async (data: EscrowPaymentData): Promise<TransactionResult> => {
    return new Promise((resolve, reject) => {
        try {
            // Validate input data
            validateTransaction(data);

            const win = getPiWindow();

            // Check if Pi SDK is available
            if (!win.Pi || typeof win.Pi.createPayment !== 'function') {
                throw new Error('Pi SDK not available. Please use Pi Browser to access this feature.');
            }

            // Calculate total amount including fee
            const totalAmount = data.amount + data.fee;

            // Prepare payment metadata (Sandbox compliant)
            const paymentMetadata = {
                type: 'escrow_payment',
                seller: data.sellerWallet,
                buyer: data.buyerUsername,
                fee: data.fee,
                description: data.description,
                timestamp: Date.now(),
                platform: ORACLE_CONFIG.NAME,
                version: ORACLE_CONFIG.VERSION
            };

            // Trigger Pi.createPayment in Sandbox mode
            win.Pi.createPayment(
                {
                    amount: totalAmount,
                    memo: `PTrust Escrow: ${data.description.substring(0, 40)}...`,
                    metadata: paymentMetadata
                },
                {
                    onReadyForServerApproval: async (paymentId: string) => {
                        console.log(`[Pi SDK] Payment ${paymentId} ready for server approval`);
                        try {
                            const response = await fetch('/api/escrow/approve', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    paymentId,
                                    sellerWallet: data.sellerWallet,
                                    amount: data.amount,
                                    fee: data.fee,
                                    description: data.description,
                                    buyerUsername: data.buyerUsername
                                })
                            });

                            const result = await response.json();
                            if (!result.success) {
                                throw new Error(result.error || 'Server approval failed');
                            }
                            console.log(`[Pi SDK] Server approved payment ${paymentId}`);
                        } catch (error: any) {
                            console.error('[Pi SDK] Approval error:', error);
                            reject(new Error(error.message || 'Payment approval failed.'));
                        }
                    },

                    onReadyForServerCompletion: async (paymentId: string, txid: string) => {
                        console.log(`[Pi SDK] Payment ${paymentId} completed with txid: ${txid}`);
                        try {
                            await fetch('/api/escrow/complete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ paymentId, txid })
                            });

                            // Successfully finished the whole flow
                            resolve({
                                paymentId,
                                id: paymentId,
                                status: 'COMPLETED',
                                txid,
                                createdAt: new Date()
                            });
                        } catch (error) {
                            console.error('[Pi SDK] Completion error:', error);
                            // We still resolve because the payment is completed on Pi side
                            resolve({
                                paymentId,
                                id: paymentId,
                                status: 'PENDING_SERVER',
                                txid,
                                createdAt: new Date()
                            });
                        }
                    },

                    onCancel: (paymentId: string) => {
                        console.warn(`[Pi SDK] Payment ${paymentId} cancelled by user`);
                        reject(new Error('Transaction was cancelled by the user.'));
                    },

                    onError: (error: Error, paymentId?: string) => {
                        console.error(`[Pi SDK] Payment ${paymentId || 'unknown'} error:`, error);
                        reject(new Error(error.message || 'An error occurred during the Pi payment process.'));
                    }
                }
            );
        } catch (error: any) {
            console.error('Create escrow transaction start error:', error);
            reject(new Error(error.message || 'Failed to initialize payment'));
        }
    });
};


/**
 * Release funds to seller
 * This function releases the locked funds to the seller after buyer confirmation
 */
export const releaseFunds = async (transactionId: string): Promise<{ success: boolean; message: string }> => {
    try {
        const response = await fetch('/api/escrow/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactionId,
                commissionWallet: ORACLE_CONFIG.COMMISSION_WALLET
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to release funds');
        }

        return { success: true, message: 'Funds released successfully to seller' };
    } catch (error: any) {
        console.error('Release funds error:', error);
        throw new Error(error.message || 'Failed to release funds');
    }
};

/**
 * Refund funds to buyer
 * This function refunds the locked funds back to the buyer
 */
export const refundFunds = async (transactionId: string): Promise<{ success: boolean; message: string }> => {
    try {
        const response = await fetch('/api/escrow/refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactionId,
                commissionWallet: ORACLE_CONFIG.COMMISSION_WALLET
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to refund funds');
        }

        return { success: true, message: 'Funds refunded successfully to buyer' };
    } catch (error: any) {
        console.error('Refund funds error:', error);
        throw new Error(error.message || 'Failed to refund funds');
    }
};

/**
 * Raise a dispute for a transaction
 * This function allows users to raise disputes for problematic transactions
 */
export const raiseDispute = async (transactionId: string, reason: string): Promise<{ success: boolean; disputeId: string }> => {
    try {
        if (!reason || reason.trim().length === 0) {
            throw new Error('Dispute reason is required');
        }

        if (reason.trim().length > 1000) {
            throw new Error('Dispute reason is too long (max 1000 characters)');
        }

        const response = await fetch('/api/escrow/dispute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactionId,
                reason,
                reportedAt: new Date().toISOString(),
                reporterWallet: ORACLE_CONFIG.COMMISSION_WALLET
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to raise dispute');
        }

        return {
            success: true,
            disputeId: result.disputeId
        };
    } catch (error: any) {
        console.error('Raise dispute error:', error);
        throw new Error(error.message || 'Failed to raise dispute');
    }
};

/**
 * Get transaction details
 * Fetches detailed information about a specific transaction
 */
export const getTransaction = async (transactionId: string) => {
    try {
        const response = await fetch(`/api/escrow/transaction/${transactionId}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Transaction not found');
        }

        return result.data;
    } catch (error: any) {
        console.error('Get transaction error:', error);
        throw new Error(error.message || 'Failed to fetch transaction');
    }
};

/**
 * Get user transactions
 * Fetches all transactions for a specific user
 */
export const getUserTransactions = async (username: string) => {
    try {
        const response = await fetch(`/api/escrow/transactions?username=${encodeURIComponent(username)}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch transactions');
        }

        return result.data;
    } catch (error: any) {
        console.error('Get user transactions error:', error);
        throw new Error(error.message || 'Failed to fetch transactions');
    }
};

/**
 * Get dashboard statistics
 * Fetches overall platform statistics
 */
export const getDashboardStats = async () => {
    try {
        const response = await fetch('/api/escrow/stats');
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch statistics');
        }

        return result.data;
    } catch (error: any) {
        console.error('Get dashboard stats error:', error);
        throw new Error(error.message || 'Failed to fetch statistics');
    }
};

// ========================================
// Export all functions
// ========================================

const escrowService = {
    createEscrowTransaction,
    releaseFunds,
    refundFunds,
    raiseDispute,
    getTransaction,
    getUserTransactions,
    getDashboardStats
};

export default escrowService;
