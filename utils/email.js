import nodemailer from 'nodemailer';

const sendEmail = async options => {
  // 1) Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // e.g., smtp.mailtrap.io or smtp.gmail.com
    port: process.env.EMAIL_PORT, // e.g., 587
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
    // For Gmail you may need `secure: false` and "Less secure apps" enabled
  });

  // 2) Define the email options
  const mailOptions = {
    from: 'Gebeta App <venushailemeskel59@gmail.com>',
    to: options.email,
    subject: options.subject,
    text: options.message
    // html: '<h1>HTML Version</h1>' // optional
  };

  // 3) Send the email
  await transporter.sendMail(mailOptions);
};

export default sendEmail;
