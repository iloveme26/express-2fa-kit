import { ConsoleEmailChannel } from "../../../src/channels/mockEmailChannel";

describe("ConsoleEmailChannel", () => {
  it("logs the code via the injected logger", async () => {
    const log = jest.fn();
    const channel = new ConsoleEmailChannel({ log });
    await channel.sendEmail({ to: "a@example.com", code: "123456", expiresInSeconds: 600 });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("123456");
    expect(log.mock.calls[0][0]).toContain("a@example.com");
  });

  it("never fails when simulateFailureRate is 0", async () => {
    const channel = new ConsoleEmailChannel({ simulateFailureRate: 0, log: jest.fn() });
    await expect(
      channel.sendEmail({ to: "a@example.com", code: "123456", expiresInSeconds: 600 })
    ).resolves.toBeUndefined();
  });

  it("always fails when simulateFailureRate is 1", async () => {
    const channel = new ConsoleEmailChannel({ simulateFailureRate: 1, log: jest.fn() });
    await expect(
      channel.sendEmail({ to: "a@example.com", code: "123456", expiresInSeconds: 600 })
    ).rejects.toThrow(/simulated delivery failure/);
  });
});
