'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import Script from 'next/script';
import { PiUser, PiAuthenticationResult, PiSDK } from '@/types/pi';

interface PiContextType {
    user: PiUser | null;
    loading: boolean;
    authenticateUser: () => Promise<void>;
}

const PiContext = createContext<PiContextType | undefined>(undefined);

/**
 * PiSDKProvider handles the initialization and authentication logic
 * for the Pi Network environment.
 */
export const PiSDKProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<PiUser | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    /**
     * Required by Pi Network: Logic to handle payments that were interrupted
     */
    const onIncompletePaymentFound = useCallback((payment: any) => {
        console.warn('[PTrust Oracle] Incomplete payment found. System recovery required:', payment);
        // Implement server-side logic here to resolve stuck transactions
    }, []);

    /**
     * Initializes the Pi SDK and sets the environment to Sandbox
     */
    const initPi = useCallback(() => {
        const piWindow = (window as any).Pi;

        if (piWindow) {
            try {
                console.log('[PTrust Oracle] Initializing Pi SDK (Sandbox Mode)...');
                (piWindow as PiSDK).init({
                    version: '2.0',
                    sandbox: true // Important: Ensure this is true for Testnet
                });
                console.log('[PTrust Oracle] Pi SDK successfully initialized.');
            } catch (error) {
                console.error('[PTrust Oracle] Failed to initialize Pi SDK:', error);
            } finally {
                setLoading(false);
            }
        }
    }, []);

    /**
     * Handles the OAuth flow with Pi Network
     */
    const authenticateUser = async () => {
        const piWindow = (window as any).Pi;

        if (!piWindow) {
            console.error('[PTrust Oracle] Authentication failed: Pi SDK not found in window.');
            return;
        }

        setLoading(true);
        try {
            console.log('[PTrust Oracle] Requesting user authentication...');

            // Scope 'payments' is required for Escrow functionality
            const auth: PiAuthenticationResult = await (piWindow as PiSDK).authenticate(
                ['username', 'payments', 'wallet_address'],
                onIncompletePaymentFound
            );

            setUser(auth.user);
            console.log('[PTrust Oracle] User authenticated successfully:', auth.user.username);
        } catch (error) {
            console.error('[PTrust Oracle] Authentication process rejected:', error);
        } finally {
            setLoading(false);
        }
    };

    // Backup check if the script loads before the component mounts
    useEffect(() => {
        if ((window as any).Pi) {
            initPi();
        }
    }, [initPi]);

    return (
        <PiContext.Provider value={{ user, loading, authenticateUser }}>
            <Script
                src="https://sdk.minepi.com/pi-sdk.js"
                strategy="lazyOnload"
                onLoad={initPi}
                onError={() => console.error('[PTrust Oracle] Critical Error: Pi SDK script failed to load.')}
            />
            {children}
        </PiContext.Provider>
    );
};

export const usePiSDK = () => {
    const context = useContext(PiContext);
    if (context === undefined) {
        throw new Error('usePiSDK must be used within a PiSDKProvider');
    }
    return context;
};