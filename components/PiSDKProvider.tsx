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

export const PiSDKProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<PiUser | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const onIncompletePaymentFound = useCallback((payment: any) => {
        console.warn('[PTrust Oracle] Incomplete payment found:', payment);
    }, []);

    const initPi = useCallback(() => {
        const piWindow = (window as any).Pi;
        if (piWindow) {
            try {
                (piWindow as PiSDK).init({
                    version: '2.0',
                    sandbox: true
                });
                console.log('[PTrust Oracle] Pi SDK initialized.');
            } catch (error) {
                console.error('[PTrust Oracle] Failed to initialize Pi SDK:', error);
            }
        }
    }, []);

    const authenticateUser = async () => {
        const piWindow = (window as any).Pi;
        if (!piWindow) {
            console.error('[PTrust Oracle] Pi SDK not found.');
            return;
        }
        setLoading(true);
        try {
            const auth: PiAuthenticationResult = await (piWindow as PiSDK).authenticate(
                ['username', 'payments', 'wallet_address'],
                onIncompletePaymentFound
            );
            setUser(auth.user);
            console.log('[PTrust Oracle] Authenticated:', auth.user.username);
        } catch (error) {
            console.error('[PTrust Oracle] Authentication failed:', error);
        } finally {
            setLoading(false);
        }
    };

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
                onError={() => console.error('[PTrust Oracle] Pi SDK failed to load.')}
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