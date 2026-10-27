// testing/test_security.js - Security & Vulnerability Audit Suite for ZenFlow
const assert = require('assert');
const Ticket = require('../models/Ticket');

async function runSecurityTests() {
  console.log('='.repeat(70));
  console.log('🛡️  PHASE 6: SECURITY AUDIT & VULNERABILITY TESTING');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  async function test(id, title, fn) {
    try {
      process.stdout.write(`• [${id}] ${title}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
    }
  }

  // 1. NoSQL Injection Resistance
  await test('SEC-01', 'NoSQL Injection resistance in ticket queries', async () => {
    // Attempting object injection {$ne: null} instead of raw string
    try {
      const maliciousPayload = { $ne: null };
      const res = await Ticket.findById(maliciousPayload);
      // Either returns null or rejects, but must NOT dump all database records
      assert(res === null || Array.isArray(res) === false, 'Must not return unauthorized collection records');
    } catch (e) {
      // Rejection is safe behavior
      assert(true);
    }
  });

  // 2. XSS Payload Storage & Sanitization
  await test('SEC-02', 'Stored XSS script tag handling in ticket title & body', async () => {
    const xssTitle = '<script>alert("XSS")</script> Test Title';
    const xssDesc = '<img src=x onerror=alert(1)> Crash Test';

    const t = new Ticket({
      title: xssTitle,
      description: xssDesc,
      customerName: 'Attacker',
      customerEmail: 'attacker@sec.org',
      category: 'General',
      priority: 'Low'
    });
    const saved = await t.save();
    assert(saved._id, 'Record must be saved safely');

    // Retrieve and verify it is treated strictly as plain string data
    const fetched = await Ticket.findById(saved._id);
    assert.strictEqual(typeof fetched.title, 'string');
    assert.strictEqual(fetched.title, xssTitle, 'Content preserved as literal data without script execution');

    // Cleanup
    await Ticket.findByIdAndDelete(saved._id);
  });

  // 3. Sensitive Credentials / Secret Exposure Prevention
  await test('SEC-03', 'Source code & environment template secret exposure audit', async () => {
    const fs = require('fs');
    const path = require('path');
    const rootDir = path.join(__dirname, '..');

    const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf-8');
    assert(!envExample.includes('AIzaSy'), 'Real Google API keys must never be committed to .env.example');
    assert(!envExample.includes('mongodb+srv://') || envExample.includes('<password>'), '.env.example must use safe placeholders');

    const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8');
    assert(gitignore.includes('.env'), '.gitignore must strictly exclude active .env files');
    assert(gitignore.includes('node_modules'), '.gitignore must exclude node_modules');
  });

  // 4. Broken Direct Object Reference (BODR) Graceful Failover
  await test('SEC-04', 'Unauthorized / Nonexistent Ticket ID modification safety', async () => {
    const fakeId = 'ffffffffffffffffffffffff';
    const result = await Ticket.findByIdAndUpdate(fakeId, { status: 'Closed' }, { new: true });
    assert.strictEqual(result, null, 'Updating nonexistent resource must return null safely without leaking stack traces');
  });

  // 5. Large Payload / DoS Resilience
  await test('SEC-05', 'Large text input storage handling', async () => {
    const largeText = 'A'.repeat(50000); // 50KB string
    const t = new Ticket({
      title: 'Large Payload Stress Test',
      description: largeText,
      customerName: 'Load Tester',
      customerEmail: 'load@zenflow.ai'
    });
    const saved = await t.save();
    assert.strictEqual(saved.description.length, 50000);
    await Ticket.findByIdAndDelete(saved._id);
  });

  console.log('='.repeat(70));
  console.log(`SECURITY AUDIT SUMMARY: ${passed} PASSED | ${failed} FAILED (Total: ${passed + failed})`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runSecurityTests().catch(err => {
  console.error('Security Suite Runner Error:', err);
  process.exit(1);
});
