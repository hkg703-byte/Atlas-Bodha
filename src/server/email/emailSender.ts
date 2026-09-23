export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  consoleLink: string;
};

const FROM_NAME = process.env.EMAIL_FROM_NAME?.trim() || "Atlas Bodha";
const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS?.trim() || "atlas@managedbyai.dev";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the configured email provider`);
  return value;
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Email provider request failed with status ${response.status}`);
  }
}

const brevoSender: EmailSender = {
  async send(message) {
    await postJson(
      "https://api.brevo.com/v3/smtp/email",
      { "api-key": requireEnvironmentVariable("BREVO_API_KEY") },
      {
        sender: { name: FROM_NAME, email: FROM_ADDRESS },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      },
    );
  },
};

const resendSender: EmailSender = {
  async send(message) {
    await postJson(
      "https://api.resend.com/emails",
      { Authorization: `Bearer ${requireEnvironmentVariable("RESEND_API_KEY")}` },
      {
        from: `${FROM_NAME} <${FROM_ADDRESS}>`,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      },
    );
  },
};

const postmarkSender: EmailSender = {
  async send(message) {
    await postJson(
      "https://api.postmarkapp.com/email",
      { "X-Postmark-Server-Token": requireEnvironmentVariable("POSTMARK_SERVER_TOKEN") },
      {
        From: `${FROM_NAME} <${FROM_ADDRESS}>`,
        To: message.to,
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
      },
    );
  },
};

const consoleSender: EmailSender = {
  async send(message) {
    if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
      throw new Error("The console email provider is disabled outside development and test");
    }
    console.info(`[email:console] Sign-in link: ${message.consoleLink}`);
  },
};

function getEmailSender(): EmailSender {
  const provider = (process.env.EMAIL_PROVIDER || "brevo").trim().toLowerCase();
  if (provider === "brevo") return brevoSender;
  if (provider === "resend") return resendSender;
  if (provider === "postmark") return postmarkSender;
  if (provider === "console") return consoleSender;
  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function sendSignInEmail(email: string, link: string): Promise<void> {
  const subject = "Your Atlas Bodha sign-in link";
  const notice =
    "This link works once and expires in 10 minutes. If you didn't ask for it, ignore this email.";
  const safeLink = escapeHtml(link);

  await getEmailSender().send({
    to: email,
    subject,
    text: `Sign in to Atlas Bodha:\n\n${link}\n\n${notice}`,
    html: `<p>Sign in to Atlas Bodha:</p><p><a href="${safeLink}">Sign in to Atlas Bodha</a></p><p>${notice}</p>`,
    consoleLink: link,
  });
}
