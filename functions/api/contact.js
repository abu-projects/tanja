/**
 * Marknate Contact Form Handler – Cloudflare Worker
 * Endpunkt: /submit & /api/contact (POST)
 *
 * Mail provider: Resend (https://resend.com)
 * Required env vars (set as secrets):
 * - RESEND_API_KEY
 * Optional env vars:
 * - CONTACT_EMAIL (default: info@marknate.ch)
 * - MAIL_FROM (default: onboarding@resend.dev)
 */

export async function onRequestPost(context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
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

        // Honeypot – bots fill hidden fields
        if (honeypot) {
            return json(
                { success: true, message: 'Nachricht erfolgreich gesendet.' },
                200,
                corsHeaders
            );
        }

        // ── Validation ──────────────────────────────────────────────
        const errors = [];
        if (!vorname) errors.push('Bitte geben Sie Ihren Vornamen ein.');
        if (!nachname) errors.push('Bitte geben Sie Ihren Nachnamen ein.');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
        }
        if (!message) errors.push('Bitte geben Sie eine Nachricht ein.');
        if (message && message.length < 10) {
            errors.push('Bitte schreiben Sie eine etwas ausführlichere Nachricht.');
        }
        if (!privacy) errors.push('Bitte stimmen Sie der Datenschutzerklärung zu.');

        if (errors.length > 0) {
            return json(
                { success: false, message: errors.join(' ') },
                422,
                corsHeaders
            );
        }

        // ── Resend API Key ──────────────────────────────────────────
        const apiKey = context.env?.RESEND_API_KEY || '';
        if (!apiKey) {
            return json(
                {
                    success: false,
                    message: 'E-Mail-Versand ist momentan nicht verfügbar. Bitte schreiben Sie direkt an info@marknate.ch.',
                    details: 'RESEND_API_KEY ist nicht gesetzt.',
                },
                500,
                corsHeaders
            );
        }

        const recipient = context.env?.CONTACT_EMAIL || 'info@marknate.ch';
        // Use your verified domain sender, or fallback to Resend's onboarding address
        const fromEmail = context.env?.MAIL_FROM || 'onboarding@resend.dev';
        const fromName = 'Marknate Website';
        const fullName = `${vorname} ${nachname}`;
        const date = new Date().toLocaleString('de-CH');
        const ip =
            context.request.headers.get('cf-connecting-ip') ||
            context.request.headers.get('x-forwarded-for') ||
            'Unbekannt';

        // ── Build email content ─────────────────────────────────────
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
            `IP: ${ip}`,
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
  <p><small>Gesendet am: ${escapeHtml(date)} | Datenschutz akzeptiert: Ja | IP: ${escapeHtml(ip)}</small></p>
</body>
</html>`;

        // ── Send via Resend API ─────────────────────────────────────
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to: [recipient],
                reply_to: email,
                subject: `[Marknate Kontaktformular] Neue Anfrage von ${fullName}`,
                text: textBody,
                html: htmlBody,
            }),
        });

        if (resendResponse.ok || resendResponse.status === 200) {
            return json(
                {
                    success: true,
                    message: 'Vielen Dank! Ihre Nachricht wurde erfolgreich gesendet. Ich melde mich in Kürze bei Ihnen.',
                },
                200,
                corsHeaders
            );
        }

        // ── Handle Resend errors ────────────────────────────────────
        const errorBody = await resendResponse.text();
        const providerError = sanitizeErrorText(errorBody);
        return json(
            {
                success: false,
                message: 'E-Mail-Versand fehlgeschlagen. Bitte versuchen Sie es später erneut oder schreiben Sie direkt an info@marknate.ch.',
                details: `Resend ${resendResponse.status}: ${providerError}`,
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
            'Access-Control-Allow-Headers': 'Content-Type, Accept',
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
