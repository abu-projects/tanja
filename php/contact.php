<?php
/**
 * Marknate Contact Form Handler
 * Sends form submissions to info@marknate.ch
 */

// Set response headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Methode nicht erlaubt.']);
    exit();
}

// Configuration
$recipient = 'info@marknate.ch';
$subject_prefix = '[Marknate Kontaktformular]';

// Get and sanitize input
$vorname  = trim(filter_input(INPUT_POST, 'vorname', FILTER_SANITIZE_SPECIAL_CHARS) ?? '');
$nachname = trim(filter_input(INPUT_POST, 'nachname', FILTER_SANITIZE_SPECIAL_CHARS) ?? '');
$email    = trim(filter_input(INPUT_POST, 'email', FILTER_SANITIZE_EMAIL) ?? '');
$message  = trim(filter_input(INPUT_POST, 'message', FILTER_SANITIZE_SPECIAL_CHARS) ?? '');
$privacy  = filter_input(INPUT_POST, 'privacy', FILTER_SANITIZE_SPECIAL_CHARS) ?? '';

// Validation
$errors = [];

if (empty($vorname)) {
    $errors[] = 'Bitte geben Sie Ihren Vornamen ein.';
}

if (empty($nachname)) {
    $errors[] = 'Bitte geben Sie Ihren Nachnamen ein.';
}

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
}

if (empty($message)) {
    $errors[] = 'Bitte geben Sie eine Nachricht ein.';
}

if (empty($privacy)) {
    $errors[] = 'Bitte stimmen Sie der Datenschutzerklärung zu.';
}

// Simple honeypot spam check
$honeypot = filter_input(INPUT_POST, 'website', FILTER_SANITIZE_SPECIAL_CHARS) ?? '';
if (!empty($honeypot)) {
    // Bot detected - pretend success
    echo json_encode(['success' => true, 'message' => 'Nachricht erfolgreich gesendet.']);
    exit();
}

// Return errors if any
if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => implode(' ', $errors)]);
    exit();
}

// Build email
$fullName = "$vorname $nachname";
$subject  = "$subject_prefix Neue Anfrage von $fullName";
$date     = date('d.m.Y H:i');

// HTML email body
$htmlBody = "
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
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
    <div class='container'>
        <div class='header'>
            <h1>Neue Kontaktanfrage</h1>
        </div>
        <div class='content'>
            <div class='field'>
                <div class='field-label'>Name</div>
                <div class='field-value'>" . htmlspecialchars($fullName) . "</div>
            </div>
            <div class='field'>
                <div class='field-label'>E-Mail</div>
                <div class='field-value'><a href='mailto:" . htmlspecialchars($email) . "' style='color: #129d63; text-decoration: none;'>" . htmlspecialchars($email) . "</a></div>
            </div>
            <div class='field'>
                <div class='field-label'>Nachricht</div>
                <div class='field-value message-value'>" . nl2br(htmlspecialchars($message)) . "</div>
            </div>
        </div>
        <div class='footer'>
            Gesendet über marknate.ch Kontaktformular am $date<br>
            Datenschutz akzeptiert: Ja
        </div>
    </div>
</body>
</html>
";

// Plain text fallback
$textBody = "Neue Kontaktanfrage über marknate.ch\n";
$textBody .= "======================================\n\n";
$textBody .= "Name: $fullName\n";
$textBody .= "E-Mail: $email\n\n";
$textBody .= "Nachricht:\n$message\n\n";
$textBody .= "--------------------------------------\n";
$textBody .= "Gesendet am: $date\n";
$textBody .= "Datenschutz akzeptiert: Ja\n";

// Email headers
$boundary = md5(time());
$headers  = "From: Marknate Website <noreply@marknate.ch>\r\n";
$headers .= "Reply-To: $fullName <$email>\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n";
$headers .= "X-Mailer: Marknate-Contact-Form/1.0\r\n";

// Multipart body
$body  = "--$boundary\r\n";
$body .= "Content-Type: text/plain; charset=UTF-8\r\n";
$body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
$body .= $textBody . "\r\n";
$body .= "--$boundary\r\n";
$body .= "Content-Type: text/html; charset=UTF-8\r\n";
$body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
$body .= $htmlBody . "\r\n";
$body .= "--$boundary--\r\n";

// Send
$sent = mail($recipient, $subject, $body, $headers);

if ($sent) {
    echo json_encode([
        'success' => true,
        'message' => 'Vielen Dank! Ihre Nachricht wurde erfolgreich gesendet. Ich melde mich in Kürze bei Ihnen.'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Es gab einen Fehler beim Senden. Bitte versuchen Sie es erneut oder schreiben Sie direkt an info@marknate.ch.'
    ]);
}
