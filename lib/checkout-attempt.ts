import { UUID_PATTERN } from "./catalog";

export type CheckoutAttempt = {
  signature: string;
  token: string;
  nickname: string;
  coupon: string;
  total: number;
};

export function readAttempt(key: string): CheckoutAttempt | null {
  try {
    const attempt = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (attempt && typeof attempt.signature === "string" && UUID_PATTERN.test(attempt.token) &&
        typeof attempt.nickname === "string" && typeof attempt.coupon === "string" &&
        Number.isFinite(attempt.total) && attempt.total > 0) return attempt;
  } catch {}
  return null;
}

export function writeAttempt(key: string, attempt: CheckoutAttempt | null) {
  try {
    if (attempt) sessionStorage.setItem(key, JSON.stringify(attempt));
    else sessionStorage.removeItem(key);
  } catch {}
}
