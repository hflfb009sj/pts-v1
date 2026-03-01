import { useCallback, useEffect, useState } from "react";

type SdkStatus = "idle" | "initializing" | "ready" | "error";

const PI_FEE_WALLET =
  "GBXO3576YTVHKCJHRRUSQEKB4YQFBQALTPO2ETG5XQDOI62HJLUON7IT";

// Minimal typing to avoid coupling to a specific Pi SDK package
type PiSdkLike = {
  initialize?: (opts: { sandbox: boolean }) => Promise<void> | void;
  auth?: {
    login: (opts: { scopes: string[] }) => Promise<any>;
    getUser?: () => Promise<any> | any;
  };
};

export default function usePiProtocol() {
  const [user, setUser] = useState<any | null>(null);
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Pi SDK (sandbox: true)
  useEffect(() => {
    let mounted = true;
    async function init() {
      setSdkStatus("initializing");
      try {
        const win = window as any;
        const pi: PiSdkLike = win?.Pi ?? ({} as PiSdkLike);

        if (typeof pi.initialize === "function") {
          await pi.initialize({ sandbox: true });
        }

        // attempt to read an already-authenticated user if available
        if (pi.auth && typeof pi.auth.getUser === "function") {
          const existing = await pi.auth.getUser();
          if (mounted && existing) setUser(existing);
        }

        if (mounted) setSdkStatus("ready");
      } catch (e: any) {
        // Defensive error handling for cases where e.every is accessed somewhere
        // Ensure we do not call e.every unless e is a proper array with every
        if (Array.isArray(e)) {
          // safely convert to string for logging
          // do not call e.every here to avoid the "e.every" issue
          console.error("Pi SDK init array error:", JSON.stringify(e));
        } else {
          console.error("Pi SDK init error:", e);
        }
        if (mounted) setSdkStatus("error");
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  // login function requesting scopes ['username','payments']
  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      const win = window as any;
      const pi: PiSdkLike = win?.Pi ?? ({} as PiSdkLike);
      if (!pi.auth || typeof pi.auth.login !== "function") {
        throw new Error("Pi SDK auth.login is not available");
      }

      const result = await pi.auth.login({ scopes: ["username", "payments"] });
      // result shape may vary by SDK; try common patterns
      const resolvedUser = result?.user ?? result ?? null;
      setUser(resolvedUser);
      setIsLoading(false);
      return resolvedUser;
    } catch (e: any) {
      // Defensive error handling to avoid "e.every" crashes
      if (Array.isArray(e)) {
        console.error("Login array error:", JSON.stringify(e));
      } else if (e && typeof e === "object" && typeof (e as any).message === "string") {
        console.error("Login error:", (e as any).message);
      } else {
        console.error("Login error:", e);
      }
      setIsLoading(false);
      return null;
    }
  }, []);

  // Fee calculation: 1% fee assigned to PI_FEE_WALLET
  const calculateFee = useCallback((amount: number) => {
    const fee = Number((amount * 0.01).toFixed(8));
    return {
      feeAmount: fee,
      destination: PI_FEE_WALLET,
      total: Number((amount + fee).toFixed(8)),
    };
  }, []);

  return {
    user,
    sdkStatus,
    login,
    isLoading,
    // expose fee helper in case consumer needs it
    calculateFee,
  };
}
