/**
 * Marknate Contact Form Handler – Cloudflare Worker
 * Endpoint: /api/contact (POST)
 *
 * Mail provider: MailChannels API
 * Required env vars:
 * - MAILCHANNELS_API_KEY
 *
 * Optional env vars:
 * - CONTACT_EMAIL (default: info@marknate.ch)
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
            return json(
                { success: true, message: 'Nachricht erfolgreich gesendet.' },
                200,
                corsHeaders
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
            return json(
                { success: false, message: errors.join(' ') },
                422,
                corsHeaders
            );
        }

        const apiKey = context.env?.MAILCHANNELS_API_KEY;
        if (!apiKey) {
            return json(
                {
                    success: false,
                    message: 'E-Mail-Versand ist nicht eingerichtet.',
                    details: 'MAILCHANNELS_API_KEY fehlt',
                },
                500,
                corsHeaders
            );
        }

        const recipient = context.env?.CONTACT_EMAIL || 'info@marknate.ch';
        const fromEmail = context.env?.MAIL_FROM || 'noreply@marknate.ch';
        const fullName = `${vorname} ${nachname}`;
        const date = new Date().toLocaleString('de-CH');

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
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; color: #111;">
  <h2>Neue Kontaktanfrage</h2>
  <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
  <p><strong>E-Mail:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
  <p><strong>Nachricht:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
  <hr>
  <p><small>Gesendet am: ${escapeHtml(date)} | Datenschutz akzeptiert: Ja</small></p>
</body>
</html>`;

        const mcResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey,
            },
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
                    { type: 'text/plain', value: textBody },
                    { type: 'text/html', value: htmlBody },
                ],
            }),
        });

        if (mcResponse.ok || mcResponse.status === 202) {
            return json(
                {
                    success: true,
                    message: 'Vielen Dank! Ihre Nachricht wurde erfolgreich gesendet. Ich melde mich in Kürze bei Ihnen.',
                },
                200,
                corsHeaders
            );
        }

        const providerError = sanitizeErrorText(await mcResponse.text());
        return json(
            {
                success: false,
                message: 'E-Mail-Versand fehlgeschlagen.',
                details: `MailChannels ${mcResponse.status}: ${providerError}`,
            },
            500,
            corsHeaders
        );
    } catch (err) {
        return json(
            {
                success: false,
                message: 'Es gab einen Fehler beim Senden. Bitte versuchen Sie es erneut oder schreiben Sie direkt an info@marknate.ch.',
                details: `Runtime: ${String(err)}`,
            },
            500,
            corsHeaders
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

function json(payload, status, headers) {
    return new Response(JSON.stringify(payload), {
        status,
        headers,
    });
}

function sanitizeErrorText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
