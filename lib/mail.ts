type TextEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type TextEmailDeliveryResult = {
  sent: boolean;
  message: string;
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

  if (!config.enabled) {
    return {
      sent: false,
      message: "Mail non inviata: configura RESEND_API_KEY e MAIL_FROM su Vercel."
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      reply_to: config.replyTo
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    return {
      sent: false,
      message: details
        ? `Mail non inviata: ${details}`
        : "Mail non inviata: il provider ha rifiutato la richiesta."
    };
  }

  return {
    sent: true,
    message: `Invito email inviato a ${input.to}.`
  };
}
