import { SendSmsParams, SmsChannel } from "./types";

export interface ConsoleSmsChannelOptions {
  /** Fraction (0-1) of sends that should reject, to exercise retry/failure paths. Default 0. */
  simulateFailureRate?: number;
  log?: (message: string) => void;
}

/** Development/example SmsChannel that logs codes to the console instead of sending real SMS. */
export class ConsoleSmsChannel implements SmsChannel {
  private readonly simulateFailureRate: number;
  private readonly log: (message: string) => void;

  constructor(options: ConsoleSmsChannelOptions = {}) {
    this.simulateFailureRate = options.simulateFailureRate ?? 0;
    // eslint-disable-next-line no-console
    this.log = options.log ?? console.log;
  }

  async sendSms(params: SendSmsParams): Promise<void> {
    if (this.simulateFailureRate > 0 && Math.random() < this.simulateFailureRate) {
      throw new Error("ConsoleSmsChannel: simulated delivery failure");
    }
    this.log(`[2fa-kit][sms] to=${params.to} code=${params.code} expiresInSeconds=${params.expiresInSeconds}`);
  }
}
