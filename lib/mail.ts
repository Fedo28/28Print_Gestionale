export type TextEmailInput = {
  to: string;
  subject: string;
  text: string;
  from?: string;
  replyTo?: string;
  idempotencyKey?: string;
};

export type TextEmailDeliveryResult = {
  sent: boolean;
  message: string;
  providerId?: string;
  ambiguous?: boolean;
};

export function getMailDeliveryConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from = process.env.MAIL_FROM?.trim() || "";
  const replyTo = process.env.MAIL_REPLY_TO?.trim() || undefined;

  return {
    apiKey,
    from,
    replyTo,
    enabled: Boolean(apiKey && from)
  };
}

export async function sendTextEmail(input: TextEmailInput): Promise<TextEmailDeliveryResult> {
  const config = getMailDeliveryConfig();
  const from = input.from || config.from;
  if (process.env.GESTIONALE_LOCAL_PREVIEW === "true") return { sent: false, message: "Anteprima locale: invio email disattivato." };

  if (!config.apiKey || !from) {
    return {
      sent: false,
      message: "Mail non inviata: configura RESEND_API_KEY e MAIL_FROM su Vercel."
    };
  }

  let response: Response;
  try { response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {})
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      reply_to: input.replyTo || config.replyTo
    }),
    signal: AbortSignal.timeout(8000)
  }); } catch { return { sent: false, ambiguous: true, message: "Esito dell’invio non confermato. Verificare il provider prima di riprovare." }; }

  if (!response.ok) {
    const details = (await response.text().catch(() => "")).replaceAll(config.apiKey, "[riservato]").slice(0, 500);
    return {
      sent: false,
      ambiguous: response.status >= 500 || response.status === 409,
      message: details
        ? `Mail non inviata: ${details}`
        : "Mail non inviata: il provider ha rifiutato la richiesta."
    };
  }

  const payload = await response.json().catch(() => null);
  if (typeof payload?.id !== "string" || !payload.id) return { sent: false, ambiguous: true, message: "Il provider non ha restituito un riferimento dell’invio. Verifica l’esito prima di riprovare." };
  return {
    sent: true,
    providerId: payload.id,
    message: `Email accettata per l’invio a ${input.to}.`
  };
}
