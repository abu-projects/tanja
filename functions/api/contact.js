/**
 * Marknate Contact Form Handler – Cloudflare Pages Function
 * Endpoint: /api/contact (POST)
 *
 * Delivery strategy:
 * 1) Resend (recommended)
 * 2) MailChannels fallback
 *
 * Optional env vars:
 * - CONTACT_EMAIL (default: info@marknate.ch)
 * - RESEND_API_KEY
 * - RESEND_FROM (default: Marknate Website <onboarding@resend.dev>)
 * - MAILCHANNELS_API_KEY
 * - MAIL_FROM (default: noreply@marknate.ch)
 */

export async function onRequestPost(context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8',
    };

    try {
        const formData = await context.request.formData();

        const vorname = (formData.get('vorname') || '').trim();
        const nachname = (formData.get('nachname') || '').trim();
        const email = (formData.get('email') || '').trim();
        const message = (formData.get('message') || '').trim();
        const privacy = (formData.get('privacy') || '').trim();
        const honeypot = (formData.get('website') || '').trim();

        if (honeypot) {
            return new Response(
                JSON.stringify({ success: true, message: 'Nachricht erfolgreich gesendet.' }),
                { status: 200, headers: corsHeaders }
            );
        }

        const errors = [];
        if (!vorname) errors.push('Bitte geben Sie Ihren Vornamen ein.');
        if (!nachname) errors.push('Bitte geben Sie Ihren Nachnamen ein.');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
        }
        if (!message) errors.push('Bitte geben Sie eine Nachricht ein.');
        if (!privacy) errors.push('Bitte stimmen Sie der Datenschutzerklärung zu.');

        if (errors.length > 0) {
            return new Response(
                JSON.stringify({ success: false, message: errors.join(' ') }),
                { status: 422, headers: corsHeaders }
            );
        }

        const recipient = context.env?.CONTACT_EMAIL || 'info@marknate.ch';
        const fullName = `${vorname} ${nachname}`;
        const now = new Date();
        const date = now.toLocaleDateString('de-CH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

        const textBody = [
            'Neue Kontaktanfrage über marknate.ch',
            '======================================',
            '',
            `Name: ${fullName}`,
            `E-Mail: ${email}`,
            '',
            'Nachricht:',
            message,
            '',
            '--------------------------------------',
            `Gesendet am: ${date}`,
            'Datenschutz akzeptiert: Ja',
        ].join('\n');

        const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #129d63; padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 30px; }
    .field { margin-bottom: 20px; }
    .field-label { font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .field-value { font-size: 16px; color: #111; padding: 12px 16px; background: #f8f8f8; border-radius: 8px; border-left: 3px solid #129d63; }
    .message-value { white-space: pre-wrap; line-height: 1.6; }
    .footer { padding: 20px 30px; background: #f8f8f8; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Neue Kontaktanfrage</h1>
    </div>
    <div class="content">
      <div class="field">
        <div class="field-label">Name</div>
        <div class="field-value">${escapeHtml(fullName)}</div>
      </div>
      <div class="field">
        <div class="field-label">E-Mail</div>
        <div class="field-value"><a href="mailto:${escapeHtml(email)}" style="color: #129d63; text-decoration: none;">${escapeHtml(email)}</a></div>
      </div>
      <div class="field">
        <div class="field-label">Nachricht</div>
        <div class="field-value message-value">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    <div class="footer">
      Gesendet über marknate.ch Kontaktformular am ${date}<br>
      Datenschutz akzeptiert: Ja
    </div>
  </div>
</body>
</html>`;

        const resendResult = await sendViaResend({
            apiKey: context.env?.RESEND_API_KEY,
            from: context.env?.RESEND_FROM || 'Marknate Website <onboarding@resend.dev>',
            recipient,
            fullName,
            email,
            textBody,
            htmlBody,
        });
        if (resendResult.ok) {
            return successResponse(corsHeaders);
        }

        const mailChannelsResult = await sendViaMailChannels({
            apiKey: context.env?.MAILCHANNELS_API_KEY,
            fromEmail: context.env?.MAIL_FROM || 'noreply@marknate.ch',
            recipient,
            fullName,
            email,
            textBody,
            htmlBody,
        });
        if (mailChannelsResult.ok) {
            return successResponse(corsHeaders);
        }

        const debugDetails = [resendResult.reason, mailChannelsResult.reason].filter(Boolean).join(' | ');
        console.error('Contact delivery failed:', debugDetails || 'unknown error');

        return new Response(
            JSON.stringify({
                success: false,
                message: 'E-Mail-Versand ist nicht korrekt eingerichtet. Bitte senden Sie direkt an info@marknate.ch.',
                details: debugDetails,
            }),
            { status: 500, headers: corsHeaders }
        );
    } catch (err) {
        console.error('Contact form error:', err);
        return new Response(
            JSON.stringify({
                success: false,
                message: 'Es gab einen Fehler beim Senden. Bitte versuchen Sie es erneut oder schreiben Sie direkt an info@marknate.ch.',
            }),
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

function successResponse(corsHeaders) {
    return new Response(
        JSON.stringify({
            success: true,
            message: 'Vielen Dank! Ihre Nachricht wurde erfolgreich gesendet. Ich melde mich in Kürze bei Ihnen.',
        }),
        { status: 200, headers: corsHeaders }
    );
}

async function sendViaResend({ apiKey, from, recipient, fullName, email, textBody, htmlBody }) {
    if (!apiKey) {
        return { ok: false, reason: 'RESEND_API_KEY fehlt' };
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: [recipient],
                reply_to: email,
                subject: `[Marknate Kontaktformular] Neue Anfrage von ${fullName}`,
                text: textBody,
                html: htmlBody,
            }),
        });

        if (response.ok) {
            return { ok: true };
        }

        const errText = await response.text();
        return { ok: false, reason: `Resend ${response.status}: ${sanitizeErrorText(errText)}` };
    } catch (err) {
        return { ok: false, reason: `Resend request failed: ${String(err)}` };
    }
}

async function sendViaMailChannels({ apiKey, fromEmail, recipient, fullName, email, textBody, htmlBody }) {
    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                personalizations: [
                    {
                        to: [{ email: recipient, name: 'Marknate' }],
                    },
                ],
                from: {
                    email: fromEmail,
                    name: 'Marknate Website',
                },
                reply_to: {
                    email,
                    name: fullName,
                },
                subject: `[Marknate Kontaktformular] Neue Anfrage von ${fullName}`,
                content: [
                    {
                        type: 'text/plain',
                        value: textBody,
                    },
                    {
                        type: 'text/html',
                        value: htmlBody,
                    },
                ],
            }),
        });

        if (response.ok || response.status === 202) {
            return { ok: true };
        }

        const errText = await response.text();
        return { ok: false, reason: `MailChannels ${response.status}: ${sanitizeErrorText(errText)}` };
    } catch (err) {
        return { ok: false, reason: `MailChannels request failed: ${String(err)}` };
    }
}

function sanitizeErrorText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
