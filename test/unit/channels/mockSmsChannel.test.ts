import { ConsoleSmsChannel } from "../../../src/channels/mockSmsChannel";

describe("ConsoleSmsChannel", () => {
  it("logs the code via the injected logger", async () => {
    const log = jest.fn();
    const channel = new ConsoleSmsChannel({ log });
    await channel.sendSms({ to: "+15551234567", code: "123456", expiresInSeconds: 600 });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("123456");
    expect(log.mock.calls[0][0]).toContain("+15551234567");
  });

  it("never fails when simulateFailureRate is 0", async () => {
    const channel = new ConsoleSmsChannel({ simulateFailureRate: 0, log: jest.fn() });
    await expect(
      channel.sendSms({ to: "+15551234567", code: "123456", expiresInSeconds: 600 })
    ).resolves.toBeUndefined();
  });

  it("always fails when simulateFailureRate is 1", async () => {
    const channel = new ConsoleSmsChannel({ simulateFailureRate: 1, log: jest.fn() });
    await expect(channel.sendSms({ to: "+15551234567", code: "123456", expiresInSeconds: 600 })).rejects.toThrow(
      /simulated delivery failure/
    );
  });
});
