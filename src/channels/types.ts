export interface SendSmsParams {
  to: string;
  code: string;
  expiresInSeconds: number;
}

export interface SendEmailParams {
  to: string;
  code: string;
  expiresInSeconds: number;
}

/** Implement against your own SMS provider (Twilio, SNS, etc.) — see docs/providers.md. */
export interface SmsChannel {
  sendSms(params: SendSmsParams): Promise<void>;
}

/** Implement against your own email provider (SendGrid, SES, etc.) — see docs/providers.md. */
export interface EmailChannel {
  sendEmail(params: SendEmailParams): Promise<void>;
}
