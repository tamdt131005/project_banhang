import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { staffLandingPath } from '../src/lib/staffLanding.ts';

function account(role, adminPermissions = []) {
  return { id: 1, email: 'user@test.local', fullName: 'Người dùng', phone: null, avatarUrl: null, role, adminPermissions };
}

describe('staff landing without database', () => {
  it('sends owner and staff to an allowed page, while customer stays in the shop', () => {
    assert.equal(staffLandingPath(account('ADMIN')), '/admin');
    assert.equal(staffLandingPath(account('STAFF', ['ORDERS'])), '/admin/don-hang');
    assert.equal(staffLandingPath(account('STAFF', ['INVENTORY'])), '/admin/kho');
    assert.equal(staffLandingPath(account('USER')), '/');
  });
});
