import nodemailer from 'nodemailer';

console.log('🔍 [DEBUG] Email module loaded at:', new Date().toISOString());

// Create transporter with current environment variables
const createTransporter = () => {
  console.log('🔍 [DEBUG] Creating email transporter...');
  console.log('🔍 [DEBUG] Current SMTP_USER:', process.env.SMTP_USER ? '***SET***' : 'MISSING');
  console.log('🔍 [DEBUG] Current SMTP_PASS:', process.env.SMTP_PASS ? '***SET***' : 'MISSING');
  
  const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  console.log('🔍 [DEBUG] Final SMTP config:', {
    host: smtpConfig.host,
    port: smtpConfig.port,
    hasUser: !!smtpConfig.auth.user,
    hasPass: !!smtpConfig.auth.pass
  });

  return nodemailer.createTransport(smtpConfig);
};

const sendEmail = async (options) => {
  console.log('\n🔍 [DEBUG] ===== SEND EMAIL CALLED =====');
  console.log('📧 To:', options.email);
  console.log('📧 Subject:', options.subject);
  
  // Check if email credentials exist
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('❌ [DEBUG] Email credentials missing in sendEmail!');
    console.log('🔍 [DEBUG] Available env vars:', {
      SMTP_USER: process.env.SMTP_USER ? 'set' : 'missing',
      SMTP_PASS: process.env.SMTP_PASS ? 'set' : 'missing'
    });
    
    // Log verification code for development
    console.log('📝 [DEBUG] Verification code for user:', options.message);
    
    return {
      success: false,
      message: 'Email not sent - credentials missing',
      verificationCode: options.message
    };
  }

  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Job Portal'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || `<p>${options.message}</p>`
    };

    console.log('📤 [DEBUG] Attempting to send email...');
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ [DEBUG] Email sent successfully!');
    console.log('📨 Message ID:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error('❌ [DEBUG] Email sending error:', error.message);
    console.error('❌ [DEBUG] Error details:', error);
    
    // Log verification code as fallback
    console.log('📝 [DEBUG] Verification code (fallback):', options.message);
    
    return {
      success: false,
      error: error.message,
      verificationCode: options.message
    };
  }
};

// Export immediately, no startup test
export default sendEmail;