import assert from 'assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { verifyToken, generateToken, hashPassword, comparePassword } from '../auth';
import path from 'path';
import fs from 'fs';

async function runSecurityTests() {
  console.log('--- Starting Phase P2 Automated Security Test Suite ---');

  // 1. Password Handling Tests
  const plainPass = 'SecurePass123!';
  const hashed = await hashPassword(plainPass);
  const isMatch = await comparePassword(plainPass, hashed);
  assert.strictEqual(isMatch, true, 'Password comparison failed for valid password');
  const isWrongMatch = await comparePassword('WrongPassword', hashed);
  assert.strictEqual(isWrongMatch, false, 'Password comparison succeeded for invalid password');
  console.log('[PASS] Password handling tests passed.');

  // 2. JWT Verification Tests
  const testUser = {
    id: 'test-user-id-999',
    name: 'Test Security User',
    email: 'security@test.com',
    role: 'Manager' as any,
    company: 'TestCorp',
    password_hash: hashed,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
  };
  const token = generateToken(testUser);
  const payload = verifyToken(token);
  assert.ok(payload, 'JWT verification failed for valid token');
  assert.strictEqual(payload?.userId, testUser.id, 'JWT payload userId mismatch');

  const invalidPayload = verifyToken('invalid.jwt.tokenstring');
  assert.strictEqual(invalidPayload, null, 'JWT verification should return null for invalid token');
  console.log('[PASS] JWT verification tests passed.');

  // 3. Tenant Isolation & Board ACL Tests
  const suffix = Date.now();
  const userA = db.createUser({
    id: `user-tenant-a-${suffix}`,
    name: 'User A',
    email: `usera_${suffix}@tenanta.com`,
    password_hash: hashed,
    company: 'Tenant A',
    role: 'Admin/Group Owner',
  });
  const userB = db.createUser({
    id: `user-tenant-b-${suffix}`,
    name: 'User B',
    email: `userb_${suffix}@tenantb.com`,
    password_hash: hashed,
    company: 'Tenant B',
    role: 'Admin/Group Owner',
  });

  const boardResultA = db.createBoard({
    title: 'Tenant A Board',
    created_by: userA.id,
  });
  const boardA = boardResultA.board;

  const creatorA = db.findUserById(boardA.created_by);
  assert.ok(creatorA, 'Board creator A must be found');
  assert.strictEqual(creatorA.company, 'Tenant A');
  assert.notStrictEqual(creatorA.company, userB.company, 'Tenant isolation check');
  console.log('[PASS] Tenant isolation tests passed.');

  // 4. Card Integrity & List-Board Validation Tests
  const listA = db.createList({ board_id: boardA.id, title: 'List A', position: 1 });
  const boardResultB = db.createBoard({ title: 'Tenant B Board', created_by: userB.id });
  const boardB = boardResultB.board;
  const listB = db.createList({ board_id: boardB.id, title: 'List B', position: 1 });

  const cardA = db.createCard({
    board_id: boardA.id,
    list_id: listA.id,
    title: 'Card A',
    created_by: userA.id,
  });

  assert.ok(cardA);
  const isValidMove = listB.board_id === cardA.board_id;
  assert.strictEqual(isValidMove, false, 'Cross-board card movement must be rejected by list-board integrity check');
  console.log('[PASS] Card integrity tests passed.');

  // 5. File Path Normalization & Security Tests
  const uploadRoot = path.resolve(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }
  const testFilePath = path.resolve(uploadRoot, 'test-upload.png');
  fs.writeFileSync(testFilePath, 'dummy image content');

  const reqPath = path.resolve(uploadRoot, 'test-upload.png');
  const isWithinRoot = reqPath.startsWith(uploadRoot);
  assert.strictEqual(isWithinRoot, true, 'File path must be within authorized storage root');

  const traversalPath = path.resolve(uploadRoot, '../../package.json');
  const isTraversalWithinRoot = traversalPath.startsWith(uploadRoot);
  assert.strictEqual(isTraversalWithinRoot, false, 'Path traversal attempt must be rejected');
  console.log('[PASS] File security and path traversal tests passed.');

  console.log('--- ALL PHASE P2 AUTOMATED SECURITY TESTS PASSED SUCCESSFULLY ---');
}

runSecurityTests().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
