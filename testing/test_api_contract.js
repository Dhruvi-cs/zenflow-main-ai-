// testing/test_api_contract.js - Node.js Gateway & Orchestrator Automated Test Suite
const assert = require('assert');
const path = require('path');
const Ticket = require('../models/Ticket');
const { triageTicket, generateAutoReplyDraft } = require('../utils/aiEngine');

async function runContractTests() {
  console.log('='.repeat(70));
  console.log('🚀 PHASE 4: AUTOMATED API CONTRACT & BACKEND ORCHESTRATOR TESTS');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;
  const results = [];

  async function it(testId, name, fn) {
    try {
      process.stdout.write(`• [${testId}] ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
      results.push({ testId, name, status: 'PASS' });
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
      results.push({ testId, name, status: 'FAIL', error: err.message });
    }
  }

  let testTicketId = null;

  // 1. Ticket Creation & Schema Validation
  await it('TC-API-01', 'Create Ticket with full schema validation', async () => {
    const t = new Ticket({
      title: 'QA Automated Contract Test Ticket',
      description: 'Verifying end-to-end data integrity across resilient store.',
      query: 'QA Automated Contract Test Ticket: VPN issue',
      customerName: 'QA Architect',
      customerEmail: 'qa@zenflow.ai',
      category: 'Technical Issue',
      priority: 'High',
      status: 'Open'
    });
    const saved = await t.save();
    assert(saved._id, 'Created ticket must return a valid _id');
    assert.strictEqual(saved.title, 'QA Automated Contract Test Ticket');
    assert.strictEqual(saved.priority, 'High');
    assert.strictEqual(saved.status, 'Open');
    testTicketId = saved._id;
  });

  // 2. Fetch Ticket by ID
  await it('TC-API-02', 'Fetch Ticket by ID and verify field types', async () => {
    const found = await Ticket.findById(testTicketId);
    assert(found, 'Ticket must be found by ID');
    assert.strictEqual(String(found._id), String(testTicketId));
    assert(Array.isArray(found.messages), 'Messages field must be an array');
  });

  // 3. Status Transition & Deflection Flag
  await it('TC-API-03', 'Update Ticket status to Deflected', async () => {
    const updated = await Ticket.findByIdAndUpdate(
      testTicketId,
      { status: 'Deflected', isDeflected: true, solutionAccepted: true },
      { new: true }
    );
    assert.strictEqual(updated.status, 'Deflected');
    assert.strictEqual(updated.isDeflected, true);
  });

  // 4. WebSocket Messages Array Persistence
  await it('TC-API-04', 'Append real-time chat messages to ticket', async () => {
    const ticket = await Ticket.findById(testTicketId);
    ticket.messages.push({
      sender: 'QA Engineer',
      text: 'Ping from automated test harness.',
      timestamp: new Date().toISOString()
    });
    const saved = await ticket.save();
    assert.strictEqual(saved.messages.length, 1);
    assert.strictEqual(saved.messages[0].sender, 'QA Engineer');
  });

  // 5. Category Filtering
  await it('TC-API-05', 'Filter tickets by category', async () => {
    const filtered = await Ticket.find({ category: 'Technical Issue' });
    assert(Array.isArray(filtered), 'Find must return array');
    assert(filtered.length > 0, 'Must contain at least 1 ticket');
  });

  // 6. AI Triage Engine Heuristics
  await it('TC-API-06', 'AI Triage Engine category detection', async () => {
    const triage = await triageTicket('Cannot connect to corporate Cisco VPN from home');
    assert.strictEqual(triage.category, 'Technical Issue');
    assert.strictEqual(triage.urgency, 'High');
  });

  // 7. AI Auto-Reply Draft Generation
  await it('TC-API-07', 'AI Auto-Reply draft synthesis', async () => {
    const draft = await generateAutoReplyDraft('Forgot my password', 'Account Issue', 'Neutral');
    assert(typeof draft === 'string', 'Draft must be a string');
    assert(draft.includes('ZenFlow Support'), 'Draft must contain ZenFlow greeting');
    assert(draft.includes('Account Issue'), 'Draft must mention the category');
  });

  // 8. Negative Test: Nonexistent Ticket Query
  await it('TC-API-08', 'Graceful handling of nonexistent ticket ID', async () => {
    const found = await Ticket.findById('nonexistent_id_99999');
    assert.strictEqual(found, null, 'Query for nonexistent ticket must return null without crashing');
  });

  // 9. Negative Test: Ticket Deletion
  await it('TC-API-09', 'Delete ticket by ID and verify removal', async () => {
    const deleted = await Ticket.findByIdAndDelete(testTicketId);
    assert(deleted, 'Delete must return deleted record');
    const check = await Ticket.findById(testTicketId);
    assert.strictEqual(check, null, 'Ticket must no longer exist after deletion');
  });

  console.log('='.repeat(70));
  console.log(`CONTRACT TEST SUMMARY: ${passed} PASSED | ${failed} FAILED (Total: ${passed + failed})`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runContractTests().catch(err => {
  console.error('Test Runner Exception:', err);
  process.exit(1);
});
