import {
  CreateOtpChallengeParams,
  CreatedOtpChallenge,
  OtpChallengeInput,
  OtpVerifyResult,
  createOtpChallenge,
  verifyOtpChallenge,
} from "./otpCode";

export function createEmailChallenge(params?: CreateOtpChallengeParams): CreatedOtpChallenge {
  return createOtpChallenge(params);
}

export function verifyEmailCode(
  challenge: OtpChallengeInput,
  code: string,
  attempts: number,
  now?: Date
): OtpVerifyResult {
  return verifyOtpChallenge(challenge, code, attempts, now);
}
