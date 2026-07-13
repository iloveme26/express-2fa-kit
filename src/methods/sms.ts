import {
  CreateOtpChallengeParams,
  CreatedOtpChallenge,
  OtpChallengeInput,
  OtpVerifyResult,
  createOtpChallenge,
  verifyOtpChallenge,
} from "./otpCode";

export function createSmsChallenge(params?: CreateOtpChallengeParams): CreatedOtpChallenge {
  return createOtpChallenge(params);
}

export function verifySmsCode(
  challenge: OtpChallengeInput,
  code: string,
  attempts: number,
  now?: Date
): OtpVerifyResult {
  return verifyOtpChallenge(challenge, code, attempts, now);
}
