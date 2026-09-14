"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ShopOrderNotificationEntry = {
  id: string;
  href: string;
  orderCode: string;
  title: string;
  customerName: string;
  totalLabel: string;
  createdLabel: string;
  deliveryLabel: string;
  shopOrderCode: string;
  shopTotalLabel: string;
};

type ShopOrderNotificationResponse = {
  count: number;
  orders: ShopOrderNotificationEntry[];
};

type StaffPushConfig = {
  enabled: boolean;
  publicKey: string | null;
  reason?: string;
};

type NotificationPermissionState = "default" | "denied" | "granted" | "unsupported";
type PushStatus = "checking" | "active" | "inactive" | "not-configured" | "blocked" | "unsupported" | "error";

const SHOP_NOTIFICATION_POLL_INTERVAL_MS = 30_000;

function BellIcon() {
  return (
    <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      <path d="M15.5 18a3.5 3.5 0 0 1-7 0" />
      <path d="M5.6 16.5h12.8l-1.2-2.1v-3.7a5.2 5.2 0 0 0-10.4 0v3.7l-1.2 2.1Z" />
      <path d="M12 4.2V3" />
    </svg>
  );
}

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "PushManager" in window &&
    "serviceWorker" in navigator
  );
}

function getBrowserNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function fetchPushConfig(): Promise<StaffPushConfig> {
  const response = await fetch("/api/notifications/push/config", {
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      enabled: false,
      publicKey: null,
      reason: "Configurazione push non disponibile."
    };
  }

  const payload = await response.json() as StaffPushConfig;
  return {
    enabled: Boolean(payload.enabled && payload.publicKey),
    publicKey: typeof payload.publicKey === "string" ? payload.publicKey : null,
    reason: typeof payload.reason === "string" ? payload.reason : undefined
  };
}

async function persistPushSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/notifications/push/subscriptions", {
    body: JSON.stringify({
      subscription: subscription.toJSON()
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "Iscrizione push non salvata.");
  }
}

async function removePushSubscription(subscription: PushSubscription) {
  await fetch("/api/notifications/push/subscriptions", {
    body: JSON.stringify({
      endpoint: subscription.endpoint
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "DELETE"
  });
}

function getPushStatusText(status: PushStatus, permission: NotificationPermissionState, message: string) {
  if (message) {
    return message;
  }

  if (status === "active") {
    return "Push attive su questo dispositivo.";
  }

  if (status === "checking") {
    return "Controllo notifiche push...";
  }

  if (status === "not-configured") {
    return "Push non ancora configurate sul server.";
  }

  if (status === "blocked" || permission === "denied") {
    return "Notifiche bloccate dal browser.";
  }

  if (status === "unsupported") {
    return "Questo dispositivo non supporta le push web.";
  }

  if (status === "error") {
    return "Non sono riuscito ad attivare le push.";
  }

  return "Attiva le push per ricevere gli ordini anche fuori dalla scheda.";
}

export function ShopOrderNotificationCenter({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [orders, setOrders] = useState<ShopOrderNotificationEntry[]>([]);
  const [permission, setPermission] = useState<NotificationPermissionState>("unsupported");
  const [pushConfig, setPushConfig] = useState<StaffPushConfig>({ enabled: false, publicKey: null });
  const [pushMessage, setPushMessage] = useState("");
  const [pushStatus, setPushStatus] = useState<PushStatus>("checking");
  const [isLoading, setIsLoading] = useState(true);
  const [isPushMutating, setIsPushMutating] = useState(false);

  useEffect(() => {
    let active = true;

    async function refreshOrders() {
      try {
        const response = await fetch("/api/orders/shop-online/pending", {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error("Notifiche shop non disponibili.");
        }

        const payload = await response.json() as ShopOrderNotificationResponse;
        if (!active) {
          return;
        }

        setCount(Number(payload.count) || 0);
        setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      } catch {
        if (active) {
          setCount(0);
          setOrders([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    async function refreshPushState() {
      setPermission(getBrowserNotificationPermission());

      if (!isPushSupported()) {
        if (active) {
          setPushStatus("unsupported");
        }
        return;
      }

      const config = await fetchPushConfig();
      if (!active) {
        return;
      }

      setPushConfig(config);

      if (!config.enabled) {
        setPushStatus("not-configured");
        setPushMessage(config.reason || "");
        return;
      }

      if (Notification.permission === "denied") {
        setPushStatus("blocked");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      setPushStatus(subscription && Notification.permission === "granted" ? "active" : "inactive");
    }

    void refreshOrders();
    void refreshPushState();
    const interval = window.setInterval(refreshOrders, SHOP_NOTIFICATION_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function requestPushPermission() {
    setPushMessage("");

    if (!isPushSupported()) {
      setPermission("unsupported");
      setPushStatus("unsupported");
      return;
    }

    setIsPushMutating(true);
    setPushStatus("checking");

    try {
      const config = pushConfig.enabled ? pushConfig : await fetchPushConfig();
      setPushConfig(config);

      if (!config.enabled || !config.publicKey) {
        setPushStatus("not-configured");
        setPushMessage(config.reason || "Chiavi Web Push non configurate.");
        return;
      }

      const nextPermission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        setPushStatus(nextPermission === "denied" ? "blocked" : "inactive");
        return;
      }

      const registration = await navigator.serviceWorker.register("/shop-push-worker.js", {
        scope: "/"
      });
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
          userVisibleOnly: true
        });
      }

      await persistPushSubscription(subscription);
      setPushStatus("active");
      setPushMessage("Push attivate su questo dispositivo.");
    } catch {
      setPushStatus("error");
      setPushMessage("Non sono riuscito ad attivare le push su questo dispositivo.");
    } finally {
      setIsPushMutating(false);
    }
  }

  async function disablePushPermission() {
    if (!isPushSupported()) {
      setPushStatus("unsupported");
      return;
    }

    setIsPushMutating(true);
    setPushMessage("");

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription);
        await subscription.unsubscribe();
      }

      setPushStatus("inactive");
      setPushMessage("Push disattivate su questo dispositivo.");
    } catch {
      setPushStatus("error");
      setPushMessage("Non sono riuscito a disattivare le push.");
    } finally {
      setIsPushMutating(false);
    }
  }

  const canActivatePush = pushStatus !== "active" && pushStatus !== "unsupported" && pushStatus !== "blocked";
  const pushStatusText = getPushStatusText(pushStatus, permission, pushMessage);

  return (
    <div className={`shop-notification-center${compact ? " is-compact" : ""}`}>
      <button
        aria-controls="shop-notification-panel"
        aria-expanded={isOpen}
        aria-label={count > 0 ? `Notifiche shop, ${count} ordini da evadere` : "Notifiche shop"}
        className={`shop-notification-trigger${count > 0 ? " has-orders" : ""}${pushStatus === "active" ? " is-push-active" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <BellIcon />
        {count > 0 ? <span>{count}</span> : null}
      </button>

      {isOpen ? (
        <div className="shop-notification-panel" id="shop-notification-panel">
          <div className="shop-notification-head">
            <div>
              <strong>Shop online</strong>
              <span>{count === 1 ? "1 ordine da evadere" : `${count} ordini da evadere`}</span>
            </div>
            <Link href="/orders?shop=online&preset=TO_DO">Vedi tutti</Link>
          </div>

          <div className={`shop-notification-push-status is-${pushStatus}`}>
            <span>{pushStatusText}</span>
            {canActivatePush ? (
              <button className="shop-notification-permission" disabled={isPushMutating} onClick={requestPushPermission} type="button">
                {isPushMutating ? "Attivazione..." : "Attiva push"}
              </button>
            ) : null}
            {pushStatus === "active" ? (
              <button className="shop-notification-disable" disabled={isPushMutating} onClick={disablePushPermission} type="button">
                Disattiva dispositivo
              </button>
            ) : null}
          </div>

          <div className="shop-notification-list">
            {orders.length ? (
              orders.map((order) => (
                <Link className="shop-notification-item" href={order.href} key={order.id} onClick={() => setIsOpen(false)}>
                  <span>{order.shopOrderCode}</span>
                  <strong>{order.customerName}</strong>
                  <small>{order.totalLabel} - {order.createdLabel}</small>
                </Link>
              ))
            ) : (
              <div className="shop-notification-empty">{isLoading ? "Controllo ordini shop..." : "Nessun ordine shop da evadere."}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
