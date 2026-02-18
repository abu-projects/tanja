/**
 * Marknate Contact Form Handler
 * Handles form validation, submission via AJAX, and UI feedback
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const form = document.getElementById('contact-form');
        if (!form) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        const statusEl = document.getElementById('form-status');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        const btnSuccess = submitBtn.querySelector('.btn-success');

        // Validate email format
        function isValidEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }

        // Show inline field error
        function showFieldError(field, message) {
            field.classList.add('border-red-400', 'focus:border-red-400', 'focus:ring-red-200');
            field.classList.remove('border-gray-200', 'focus:border-brand', 'focus:ring-brand/20');

            let errorEl = field.parentElement.querySelector('.field-error');
            if (!errorEl) {
                errorEl = document.createElement('p');
                errorEl.className = 'field-error text-red-500 text-xs mt-1 font-medium';
                field.parentElement.appendChild(errorEl);
            }
            errorEl.textContent = message;
        }

        // Clear field error
        function clearFieldError(field) {
            field.classList.remove('border-red-400', 'focus:border-red-400', 'focus:ring-red-200');
            field.classList.add('border-gray-200', 'focus:border-brand', 'focus:ring-brand/20');

            const errorEl = field.parentElement.querySelector('.field-error');
            if (errorEl) errorEl.remove();
        }

        // Real-time validation on blur
        form.querySelectorAll('input, textarea').forEach(function (field) {
            field.addEventListener('blur', function () {
                validateField(field);
            });

            field.addEventListener('input', function () {
                if (field.parentElement.querySelector('.field-error')) {
                    validateField(field);
                }
            });
        });

        function validateField(field) {
            const value = field.value.trim();
            const id = field.id;

            if (id === 'vorname' && !value) {
                showFieldError(field, 'Vorname ist erforderlich');
                return false;
            }
            if (id === 'nachname' && !value) {
                showFieldError(field, 'Nachname ist erforderlich');
                return false;
            }
            if (id === 'email') {
                if (!value) {
                    showFieldError(field, 'E-Mail ist erforderlich');
                    return false;
                }
                if (!isValidEmail(value)) {
                    showFieldError(field, 'Bitte gültige E-Mail-Adresse eingeben');
                    return false;
                }
            }
            if (id === 'message' && !value) {
                showFieldError(field, 'Nachricht ist erforderlich');
                return false;
            }

            clearFieldError(field);
            return true;
        }

        // Show status message
        function showStatus(type, message) {
            statusEl.className = 'form-status mt-4 p-4 rounded-xl text-sm font-medium flex items-center gap-2';

            if (type === 'success') {
                statusEl.classList.add('bg-brand-light/50', 'text-brand-dark', 'border', 'border-brand/20');
                statusEl.innerHTML = '<span class="iconify shrink-0" data-icon="lucide:check-circle" data-width="20"></span>' + message;
            } else if (type === 'error') {
                statusEl.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
                statusEl.innerHTML = '<span class="iconify shrink-0" data-icon="lucide:alert-circle" data-width="20"></span>' + message;
            }

            statusEl.classList.remove('hidden');
        }

        // Set button state
        function setButtonState(state) {
            if (state === 'loading') {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
                btnText.classList.add('hidden');
                btnLoader.classList.remove('hidden');
                btnSuccess.classList.add('hidden');
            } else if (state === 'success') {
                submitBtn.disabled = true;
                btnText.classList.add('hidden');
                btnLoader.classList.add('hidden');
                btnSuccess.classList.remove('hidden');
                submitBtn.classList.remove('opacity-80');
                submitBtn.classList.add('bg-brand-dark');
            } else {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-80', 'cursor-not-allowed', 'bg-brand-dark');
                btnText.classList.remove('hidden');
                btnLoader.classList.add('hidden');
                btnSuccess.classList.add('hidden');
            }
        }

        // Handle form submit
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Clear previous status
            statusEl.classList.add('hidden');

            // Validate all fields
            let isValid = true;
            const fields = ['vorname', 'nachname', 'email', 'message'];
            fields.forEach(function (id) {
                const field = document.getElementById(id);
                if (!validateField(field)) {
                    isValid = false;
                }
            });

            // Check privacy checkbox
            const privacyBox = document.getElementById('privacy');
            if (!privacyBox.checked) {
                showStatus('error', 'Bitte stimmen Sie der Datenschutzerklärung zu.');
                isValid = false;
            }

            if (!isValid) return;

            // Submit via AJAX
            setButtonState('loading');

            const formData = new FormData(form);

            fetch('/api/contact', {
                method: 'POST',
                body: formData
            })
                .then(function (response) {
                    return response.json().then(function (data) {
                        return { ok: response.ok, data: data };
                    });
                })
                .then(function (result) {
                    if (result.ok && result.data.success) {
                        setButtonState('success');
                        showStatus('success', result.data.message);
                        form.reset();

                        // Reset button after 5 seconds
                        setTimeout(function () {
                            setButtonState('default');
                        }, 5000);
                    } else {
                        setButtonState('default');
                        showStatus('error', result.data.message || 'Es gab einen Fehler. Bitte versuchen Sie es erneut.');
                    }
                })
                .catch(function () {
                    setButtonState('default');
                    showStatus('error', 'Verbindungsfehler. Bitte versuchen Sie es erneut oder schreiben Sie an info@marknate.ch.');
                });
        });
    });
})();
