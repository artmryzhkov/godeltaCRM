const nodemailer = require('nodemailer');

module.exports = class Email {
  constructor(user, url, token) {
    this.to = user.email;
    this.firstName = user.name ? user.name.split(' ')[0] : '';
    this.url = url;
    this.from = `Toe Robert <${process.env.EMAIL_FROM}>`;
    this.token = token;
  }

  newTransport() {
    return nodemailer.createTransport({
      service: 'Sendgrid',
      auth: {
        user: process.env.SENDGRID_USER,
        pass: process.env.SENDGRID_PASS,
      },
    });
  }

  async send(message, subject) {
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html: message,
    };

    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send(
      `<h1>Welcome, Please verify your account before you continue!</h1>
      <h3>This account will be deleted from our end in 24 hours if you do not do any actions.<h3> <a href="${this.url}"> Click here to verify </a>`,
      'Welcome to the Family!'
    );
  }

  async sendVerification() {
    await this.send(
      `<h1>Please verify your email to change it!</h1>
      <h3>Copy the below token and verify your email with this. Note: This token is validated for 10 minutes only!<h3> <p>${this.token}</p>`,
      'Verify email. Token valid for 10 minutes!'
    );
  }

  async sendPasswordReset() {
    await this.send(
      `<a href="${this.url}">Click here to reset password</a>`,
      'Your password reset token (valid for only 10 minutes)'
    );
  }
};
