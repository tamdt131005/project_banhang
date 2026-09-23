import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { changePasswordSchema } from '../src/modules/auth/auth.schema.js';
import { staffAccessSchema, staffCreateSchema } from '../src/modules/users/user.schema.js';

describe('staff account policy without database', () => {
  it('requires an initial password and at least one permission for new staff', () => {
    const valid = staffCreateSchema.parse({
      email: 'NHANVIEN@EXAMPLE.COM',
      password: 'MatKhau@123',
      fullName: 'Nhân Viên',
      permissions: ['ORDERS'],
    });
    assert.equal(valid.email, 'nhanvien@example.com');
    assert.equal(staffCreateSchema.safeParse({ ...valid, permissions: [] }).success, false);
    assert.equal(staffCreateSchema.safeParse({ ...valid, permissions: ['ORDERS', 'ORDERS'] }).success, false);
    assert.equal(staffCreateSchema.safeParse({ ...valid, password: '123' }).success, false);
  });

  it('does not accept a customer role in permission updates', () => {
    assert.equal(staffAccessSchema.safeParse({ permissions: ['INVENTORY'] }).success, true);
    assert.equal(staffAccessSchema.safeParse({ role: 'USER', permissions: ['INVENTORY'] }).success, false);
  });

  it('requires current and different new password', () => {
    assert.equal(changePasswordSchema.safeParse({
      currentPassword: 'OldPass@123',
      newPassword: 'NewPass@123',
    }).success, true);
    assert.equal(changePasswordSchema.safeParse({
      currentPassword: 'OldPass@123',
      newPassword: 'OldPass@123',
    }).success, false);
  });
});
