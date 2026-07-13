import { EmailChannel, SendEmailParams, SendSmsParams, SmsChannel } from "../../src/channels/types";

/** Test-only channel that records delivered codes instead of sending anything real. */
export class RecordingSmsChannel implements SmsChannel {
  readonly sent: SendSmsParams[] = [];

  async sendSms(params: SendSmsParams): Promise<void> {
    this.sent.push(params);
  }

  lastCode(): string | undefined {
    return this.sent[this.sent.length - 1]?.code;
  }
}

export class RecordingEmailChannel implements EmailChannel {
  readonly sent: SendEmailParams[] = [];

  async sendEmail(params: SendEmailParams): Promise<void> {
    this.sent.push(params);
  }

  lastCode(): string | undefined {
    return this.sent[this.sent.length - 1]?.code;
  }
}
