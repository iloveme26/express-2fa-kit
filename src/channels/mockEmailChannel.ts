import { EmailChannel, SendEmailParams } from "./types";

export interface ConsoleEmailChannelOptions {
  /** Fraction (0-1) of sends that should reject, to exercise retry/failure paths. Default 0. */
  simulateFailureRate?: number;
  log?: (message: string) => void;
}

/** Development/example EmailChannel that logs codes to the console instead of sending real email. */
export class ConsoleEmailChannel implements EmailChannel {
  private readonly simulateFailureRate: number;
  private readonly log: (message: string) => void;

  constructor(options: ConsoleEmailChannelOptions = {}) {
    this.simulateFailureRate = options.simulateFailureRate ?? 0;
    // eslint-disable-next-line no-console
    this.log = options.log ?? console.log;
  }

  async sendEmail(params: SendEmailParams): Promise<void> {
    if (this.simulateFailureRate > 0 && Math.random() < this.simulateFailureRate) {
      throw new Error("ConsoleEmailChannel: simulated delivery failure");
    }
    this.log(`[2fa-kit][email] to=${params.to} code=${params.code} expiresInSeconds=${params.expiresInSeconds}`);
  }
}
