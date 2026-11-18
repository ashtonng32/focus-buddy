"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function toBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribe() {
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) }));
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
}

type Status = "checking" | "unsupported" | "needs-permission" | "denied" | "on";

/** Asks once for notification permission, then keeps this phone's push subscription saved. */
export function PushSetup() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const t = setTimeout(() => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !KEY) {
        setStatus("unsupported");
      } else if (Notification.permission === "granted") {
        subscribe().then(() => setStatus("on"), () => setStatus("needs-permission"));
      } else if (Notification.permission === "denied") {
        setStatus("denied");
      } else {
        setStatus("needs-permission");
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function enable() {
    const result = await Notification.requestPermission();
    if (result !== "granted") return setStatus(result === "denied" ? "denied" : "needs-permission");
    try {
      await subscribe();
      setStatus("on");
    } catch {
      setStatus("needs-permission");
    }
  }

  if (status === "needs-permission") {
    return (
      <Button variant="outline" className="h-14 text-lg" onClick={enable}>
        Turn on check-ins
      </Button>
    );
  }
  if (status === "denied") {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Notifications are blocked. Allow them for this app in Chrome&apos;s site settings.
      </p>
    );
  }
  if (status === "unsupported") {
    return (
      <p className="text-center text-sm text-muted-foreground">
        This browser can&apos;t send check-ins. Open the installed app on your phone.
      </p>
    );
  }
  return null;
}
