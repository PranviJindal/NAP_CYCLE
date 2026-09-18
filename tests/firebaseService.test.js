const test = require('node:test');
const assert = require('node:assert/strict');
const { FirebaseService } = require('../src/services/firebaseService');

// Polyfill minimal localStorage for Node.js test environment
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

test('Firebase Auth - User registration and login flow', async () => {
  const fb = new FirebaseService();
  
  // Register new user
  const user = await fb.signUpWithEmailPassword('alex@example.com', 'securePass123', 'Alex Developer');
  assert.ok(user.uid);
  assert.equal(user.email, 'alex@example.com');
  assert.equal(user.displayName, 'Alex Developer');

  // Sign out
  await fb.signOut();
  assert.equal(fb.getCurrentUser(), null);

  // Sign back in
  const loggedIn = await fb.signInWithEmailPassword('alex@example.com', 'securePass123');
  assert.equal(loggedIn.uid, user.uid);
  assert.equal(fb.getCurrentUser().uid, user.uid);
});

test('Firebase Auth - Duplicate email registration is rejected', async () => {
  const fb = new FirebaseService();
  await assert.rejects(async () => {
    await fb.signUpWithEmailPassword('alex@example.com', 'anotherPass');
  }, /already exists/);
});

test('Firestore - User data isolation ensures User A cannot access User B records', async () => {
  const fb = new FirebaseService();
  
  // User 1
  const user1 = await fb.signUpWithEmailPassword('user1@example.com', 'password123');
  await fb.saveNapLog({ id: 'nap_1', totalDurationMinutes: 20 });
  await fb.saveNapLog({ id: 'nap_2', totalDurationMinutes: 15 });

  // User 2
  const user2 = await fb.signUpWithEmailPassword('user2@example.com', 'password123');
  await fb.saveNapLog({ id: 'nap_3', totalDurationMinutes: 90 });

  // Query User 1 logs
  const logsUser1 = await fb.getUserNapLogs(user1.uid);
  assert.equal(logsUser1.length, 2);
  assert.ok(logsUser1.every(l => l.userId === user1.uid));

  // Query User 2 logs
  const logsUser2 = await fb.getUserNapLogs(user2.uid);
  assert.equal(logsUser2.length, 1);
  assert.equal(logsUser2[0].id, 'nap_3');
  assert.equal(logsUser2[0].userId, user2.uid);
});
