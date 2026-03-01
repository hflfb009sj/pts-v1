// LOCKED FILE

import { useState, useEffect } from "react";
import { PI_NETWORK_CONFIG, BACKEND_URLS } from "@/lib/system-config";

interface PiAuthResult {
  accessToken: string;
  user: {
    uid: string;
    username: string;
  };
}

declare global {
  interface Window {
    Pi: {
      init: (config: { version: string; sandbox?: boolean }) => Promise<void>;
      authenticate: (scopes: string[]) => Promise<PiAuthResult>;
    };
  }
}

const COMMUNICATION_REQUEST_TYPE = '@pi:app:sdk:communication_information_request';
const DEFAULT_ERROR_MESSAGE = 'Failed to authenticate or login. Please refresh and try again.';

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (error) {
    // Cross-origin access may throw when in an iframe
    if (
      error instanceof DOMException &&
      (error.name === 'SecurityError' || error.code === DOMException.SECURITY_ERR || error.code === 18)
    ) {
      return true;
    }
    // Firefox may throw generic Permission denied errors
    if (error instanceof Error && /Permission denied/i.test(error.message)) {
      return true;
    }

    throw error;
  }
}

function parseJsonSafely(value: any): any {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return typeof value === 'object' && value !== null ? value : null;
}

// Function to dynamically load Pi SDK script
const loadPiSDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    if (!PI_NETWORK_CONFIG.SDK_URL) {
      throw new Error("SDK URL is not set");
    }
    script.src = PI_NETWORK_CONFIG.SDK_URL;
    script.async = true;

    script.onload = () => {
      console.log("✅ Pi SDK script loaded successfully");
      resolve();
    };

    script.onerror = () => {
      console.error("❌ Failed to load Pi SDK script");
      reject(new Error("Failed to load Pi SDK script"));
    };

    document.head.appendChild(script);
  });
};

/**
 * Requests authentication credentials from the parent window (App Studio) via postMessage.
 * Returns null if not in iframe, timeout, or missing token (non-fatal check).
 *
 * @returns {Promise<{accessToken: string, appId: string}|null>} Resolves with credentials or null
 */
function requestParentCredentials(): Promise<{ accessToken: string; appId: string | null } | null> {
  // Early return if not in an iframe
  if (!isInIframe()) {
    return Promise.resolve(null);
  }

  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const timeoutMs = 1500;

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Cleanup function to remove listener and clear timeout
    const cleanup = (listener: (event: MessageEvent) => void) => {
      window.removeEventListener('message', listener);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };

    const messageListener = (event: MessageEvent) => {
      // Security: only accept messages from parent window
      if (event.source !== window.parent) {
        return;
      }

      // Validate message type and request ID match
      const data = parseJsonSafely(event.data);
      if (!data || data.type !== COMMUNICATION_REQUEST_TYPE || data.id !== requestId) {
        return;
      }

      cleanup(messageListener);

      // Extract credentials from response payload
      const payload = typeof data.payload === 'object' && data.payload !== null ? data.payload : {};
      const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken : null;
      const appId = typeof payload.appId === 'string' ? payload.appId : null;

      // Return credentials or null if missing token
      resolve(accessToken ? { accessToken, appId } : null);
    };

    // Set timeout handler (resolve with null on timeout)
    timeoutId = setTimeout(() => {
      cleanup(messageListener);
      resolve(null);
    }, timeoutMs);

    // Register listener before sending request
    window.addEventListener('message', messageListener);

    // Send request to parent window to get credentials
    window.parent.postMessage(
      JSON.stringify({
        type: COMMUNICATION_REQUEST_TYPE,
        id: requestId
      }),
      '*'
    );
  });
}

async function loginWithBackend(accessToken: string, appId: string | null): Promise<void> {
  let endpoint: string;
  let payload: { pi_auth_token: string; app_id?: string };
  if (appId) {
    endpoint = BACKEND_URLS.LOGIN_PREVIEW;
    payload = { pi_auth_token: accessToken, app_id: appId };
  } else {
    endpoint = BACKEND_URLS.LOGIN;
    payload = { pi_auth_token: accessToken };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }
  } catch (error) {
    throw new Error(DEFAULT_ERROR_MESSAGE);
  }
}

export const usePiNetworkAuthentication = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState("Initializing Pi Network...");
  const [piAccessToken, setPiAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authenticateViaPiSdk = async (): Promise<void> => {
    setAuthMessage("Initializing Pi Network...");
    await window.Pi.init({ version: '2.0', sandbox: PI_NETWORK_CONFIG.SANDBOX });

    setAuthMessage("Authenticating Pi Network...");
    const scopes = ['username', 'roles', 'payments'];
    const piAuthResult = await window.Pi.authenticate(scopes);

    if (!piAuthResult.accessToken) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    setAuthMessage("Logging in...");
    await loginWithBackend(piAuthResult.accessToken, null);
    setPiAccessToken(piAuthResult.accessToken);
  };

  const initializePiAndAuthenticate = async () => {
    setError(null);
    try {
      // Probe for parent credentials (App Studio iframe environment)
      const parentCredentials = await requestParentCredentials();

      // If parent (App Studio) provides credentials, use iframe flow
      if (parentCredentials) {
        setPiAccessToken(parentCredentials.accessToken);
        setAuthMessage("Logging in...");
        await loginWithBackend(parentCredentials.accessToken, parentCredentials.appId);
      } else {
        // Fallback to Pi SDK authentication
        setAuthMessage("Loading Pi Network SDK...");
        await loadPiSDK();

        // Verify Pi object is available
        if (typeof window.Pi === "undefined") {
          throw new Error("Pi object not available after script load");
        }

        await authenticateViaPiSdk();
      }

      // Success
      setIsAuthenticated(true);
    } catch (err) {
      console.error("❌ Pi Network initialization failed:", err);
      const errorMessage = err instanceof Error && err.message ? err.message : DEFAULT_ERROR_MESSAGE;
      setAuthMessage(errorMessage);
      setError(errorMessage);
    }
  };

  useEffect(() => {
    initializePiAndAuthenticate();
  }, []);

  return {
    isAuthenticated,
    authMessage,
    piAccessToken,
    error,
    reinitialize: initializePiAndAuthenticate,
  };
};
