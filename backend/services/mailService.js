const nodemailer = require('nodemailer');

let transporter = null;

function hasMailConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const password = String(process.env.SMTP_PASSWORD || '').trim();

  if (!host || !user || !password) return false;
  if (user === 'your-email@gmail.com') return false;
  if (password === 'your-app-password') return false;
  return true;
}

function getTransporter() {
  if (!hasMailConfig()) return null;
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      delivered: false,
      status: 'not_configured',
    };
  }

  await mailer.sendMail({
    from: process.env.CONTACT_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  return {
    delivered: true,
    status: 'sent',
  };
}

module.exports = {
  hasMailConfig,
  sendMail,
};
