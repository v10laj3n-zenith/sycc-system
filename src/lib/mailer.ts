import "server-only";
import nodemailer from "nodemailer";
import { formatManilaDate, formatPhp } from "@/lib/format";

export interface GivingReceiptEmailInput {
  toEmail: string;
  giverName: string;
  serviceDate: string;
  entries: Array<{
    givingType: string;
    paymentMethod: string;
    amount: number;
    referenceNumber?: string | null;
  }>;
  seasonTitle?: string;
}

function getGmailTransporter() {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass || pass.includes("<")) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendGivingReceiptEmail(
  input: GivingReceiptEmailInput
): Promise<{ sent: boolean; reason?: string }> {
  const transporter = getGmailTransporter();
  if (!transporter) {
    return { sent: false, reason: "Gmail SMTP credentials not configured" };
  }

  const totalAmount = input.entries.reduce((sum, e) => sum + e.amount, 0);
  const formattedDate = formatManilaDate(input.serviceDate);

  const rowsHtml = input.entries
    .map(
      (entry) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-transform:capitalize;color:#1e293b;">${entry.givingType}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569;">${
          entry.paymentMethod === "gcash_ewallet"
            ? `GCash / E-Wallet${entry.referenceNumber ? ` (${entry.referenceNumber})` : ""}`
            : "Cash"
        }</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#0f172a;">${formatPhp(entry.amount)}</td>
      </tr>`
    )
    .join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:24px;">
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg,#DBEAFE 0%,#DCFCE7 100%);padding:24px;border-bottom:1px solid #cbd5e1;">
        <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#1E3A8A;font-weight:700;">SYCC Youth Treasury</p>
        <h1 style="margin:6px 0 0;font-size:22px;color:#0f172a;">Giving Acknowledgment Receipt</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#334155;">Saturday Service — ${formattedDate}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;color:#334155;font-size:15px;">
          Dear <strong>${input.giverName}</strong>, thank you for your cheerful and faithful generosity in supporting the youth ministry!
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;color:#475569;">Category</th>
              <th style="padding:10px 12px;text-align:left;color:#475569;">Method</th>
              <th style="padding:10px 12px;text-align:right;color:#475569;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background:#DBEAFE;">
              <td colspan="2" style="padding:12px;font-weight:700;color:#1E3A8A;">Total Verified Giving</td>
              <td style="padding:12px;text-align:right;font-weight:700;color:#1E3A8A;">${formatPhp(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;font-style:italic;">
          "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver." — 2 Corinthians 9:7
        </p>
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">
          Verified via 2-Counter PIN Liquidation Sign-Off · ${input.seasonTitle ?? "SYCC Youth Growth System"}
        </p>
      </div>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `"SYCC Youth Treasury" <${process.env.GMAIL_SMTP_USER}>`,
    to: input.toEmail,
    subject: `SYCC Youth Giving Receipt — ${formattedDate} (${formatPhp(totalAmount)})`,
    html,
  });

  return { sent: true };
}
