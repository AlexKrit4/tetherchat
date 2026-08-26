import { describe, expect, it } from 'vitest';
import {
  notificationPaidAmount,
  parseRubToKopecks,
  paymentCoversOrder,
} from './config.js';

describe('parseRubToKopecks', () => {
  it('parses whole rubles and fractional amounts', () => {
    expect(parseRubToKopecks('100')).toBe(10_000);
    expect(parseRubToKopecks('100.00')).toBe(10_000);
    expect(parseRubToKopecks('100.5')).toBe(10_050);
    expect(parseRubToKopecks('1.01')).toBe(101);
    expect(parseRubToKopecks(' 50,50 ')).toBe(5_050);
  });

  it('rejects malformed amounts', () => {
    expect(parseRubToKopecks('')).toBeNull();
    expect(parseRubToKopecks('abc')).toBeNull();
    expect(parseRubToKopecks('100.999')).toBeNull();
    expect(parseRubToKopecks('-1')).toBeNull();
  });
});

describe('paymentCoversOrder', () => {
  it('accepts an exact or larger payment', () => {
    expect(paymentCoversOrder('600.00', '600.00')).toBe(true);
    expect(paymentCoversOrder('600', '600.00')).toBe(true);
    expect(paymentCoversOrder('601.00', '600.00')).toBe(true);
  });

  it('rejects an underpayment that would otherwise activate a full plan', () => {
    expect(paymentCoversOrder('1.00', '600.00')).toBe(false);
    expect(paymentCoversOrder('599.99', '600.00')).toBe(false);
    expect(paymentCoversOrder('0', '50.00')).toBe(false);
  });

  it('rejects unparseable amounts instead of coercing them to zero', () => {
    expect(paymentCoversOrder('not-a-number', '100.00')).toBe(false);
    expect(paymentCoversOrder('100.00', '')).toBe(false);
  });
});

describe('notificationPaidAmount', () => {
  it('prefers withdraw_amount so shop commission cannot under-count the payer', () => {
    expect(
      notificationPaidAmount({
        amount: '99.50',
        withdraw_amount: '100.00',
      }),
    ).toBe('100.00');
  });

  it('falls back to the credited amount', () => {
    expect(notificationPaidAmount({ amount: '200.00' })).toBe('200.00');
    expect(notificationPaidAmount({})).toBe('0');
  });
});
