import { describe, expect, it } from 'vitest';
import { assertAdmin, assertSignedIn, assertVendorOf, AuthError, type Session } from './auth-rules';

const customer: Session = { userId: 'u1', displayName: 'ฝ้าย', role: 'customer', shopId: null };
const vendorA: Session = { userId: 'u2', displayName: 'ร้าน A', role: 'vendor', shopId: 'shop-a' };
const admin: Session = { userId: 'u3', displayName: 'ผู้ดูแล', role: 'admin', shopId: null };

const reason = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AuthError ? e.reason : 'other';
  }
  return 'allowed';
};

describe('assertVendorOf', () => {
  it('lets a vendor act on their own shop', () => {
    expect(assertVendorOf(vendorA, 'shop-a')).toBe(vendorA);
  });
  it('blocks a vendor on another shop', () => {
    expect(reason(() => assertVendorOf(vendorA, 'shop-b'))).toBe('forbidden');
  });
  it('blocks customers and signed-out callers', () => {
    expect(reason(() => assertVendorOf(customer, 'shop-a'))).toBe('forbidden');
    expect(reason(() => assertVendorOf(null, 'shop-a'))).toBe('signed_out');
  });
  it('blocks a vendor profile with no shop', () => {
    expect(reason(() => assertVendorOf({ ...vendorA, shopId: null }, 'shop-a'))).toBe('forbidden');
  });
  it('lets an admin act on any shop', () => {
    expect(assertVendorOf(admin, 'shop-b')).toBe(admin);
  });
});

describe('assertAdmin / assertSignedIn', () => {
  it('admin only', () => {
    expect(assertAdmin(admin)).toBe(admin);
    expect(reason(() => assertAdmin(vendorA))).toBe('forbidden');
    expect(reason(() => assertAdmin(null))).toBe('signed_out');
  });
  it('any signed-in user', () => {
    expect(assertSignedIn(customer)).toBe(customer);
    expect(reason(() => assertSignedIn(null))).toBe('signed_out');
  });
});
