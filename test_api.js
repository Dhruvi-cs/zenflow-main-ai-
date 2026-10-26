// test_api.js - Comprehensive End-to-End Test Suite for ZenFlow
const assert = require('assert');
const Ticket = require('./models/Ticket');
const { triageTicket, generateAutoReplyDraft } = require('./utils/aiEngine');

async function runTests() {
  console.log('='.repeat(65));
  console.log('🧪 ZENFLOW AUTOMATED INTEGRATION & CONTRACT TEST SUITE');
  console.log('='.repeat(65));

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• Testing: ${name}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  // Test 1: Ticket Model Creation & Local/Mongo Fallback
  let createdTicketId = null;
  await test('Ticket Creation & Storage Persistence', async () => {
    const t = new Ticket({
      title: 'Automated Test Ticket - VPN Failure',
      description: 'Test description for integration suite verification.',
      query: 'Automated Test Ticket: VPN Failure',
      customerName: 'Integration Runner',
      customerEmail: 'test@zenflow.ai',
      category: 'Technical Issue',
      priority: 'High',
      status: 'Open'
    });
    const saved = await t.save();
    assert(saved._id, 'Saved ticket must have an _id');
    assert.strictEqual(saved.title, 'Automated Test Ticket - VPN Failure');
    assert.strictEqual(saved.category, 'Technical Issue');
    createdTicketId = saved._id;
  });

  // Test 2: Ticket Retrieval by ID
  await test('Fetch Ticket by ID', async () => {
    const fetched = await Ticket.findById(createdTicketId);
    assert(fetched, 'Ticket should be found by ID');
    assert.strictEqual(String(fetched._id), String(createdTicketId));
  });

  // Test 3: Ticket Listing & Filtering
  await test('List Tickets & Category Filtering', async () => {
    const all = await Ticket.find();
    assert(Array.isArray(all), 'Tickets result must be an array');
    assert(all.length >= 1, 'Should contain at least 1 ticket');

    const filtered = await Ticket.find({ category: 'Technical Issue' });
    assert(Array.isArray(filtered), 'Filtered tickets must be an array');
    assert(filtered.some(t => t.category === 'Technical Issue'), 'Should match category');
  });

  // Test 4: Dashboard Aggregations Computation
  await test('Dashboard Metrics Calculation', async () => {
    const all = await Ticket.find();
    const total = all.length;
    const open = all.filter(t => t.status === 'Open').length;
    const resolved = all.filter(t => t.status === 'Resolved').length;
    const deflected = all.filter(t => t.status === 'Deflected' || t.deflected === true).length;
    
    assert(typeof total === 'number', 'Total must be a number');
    assert(typeof open === 'number', 'Open must be a number');
    assert(typeof deflected === 'number', 'Deflected must be a number');
  });

  // Test 5: Ticket Update (Status Transition to Deflected)
  await test('Ticket Status Update (Deflection Transition)', async () => {
    const updated = await Ticket.findByIdAndUpdate(createdTicketId, {
      $set: {
        status: 'Deflected',
        deflected: true,
        ai_response: 'Automated solution verified by unit test.'
      }
    }, { new: true });

    assert(updated, 'Updated ticket must not be null');
    assert.strictEqual(updated.status, 'Deflected');
    assert.strictEqual(updated.deflected, true);
  });

  // Test 6: Real-time Message Appending in Ticket
  await test('Ticket Messages Array Persistence', async () => {
    const updated = await Ticket.findByIdAndUpdate(createdTicketId, {
      $push: {
        messages: {
          sender: 'Test Agent',
          message: 'Hello, this is a real-time collaboration test.',
          timestamp: '12:00 PM',
          createdAt: new Date()
        }
      }
    }, { new: true });

    assert(updated, 'Ticket with appended message must exist');
    assert(Array.isArray(updated.messages), 'Messages must be an array');
    assert(updated.messages.length >= 1, 'Messages length must be >= 1');
  });

  // Test 7: AI Triage Rule Engine
  await test('AI Triage Engine (Account Category Detection)', async () => {
    const triage1 = await triageTicket('I forgot my password and cannot login to my account');
    assert.strictEqual(triage1.category, 'Account Issue');
    assert(triage1.aiSummary, 'Must provide an aiSummary');

    const triage2 = await triageTicket('My credit card was charged twice for the monthly subscription');
    assert.strictEqual(triage2.category, 'Billing');
    assert.strictEqual(triage2.urgency, 'High');
  });

  // Test 8: Auto Reply Draft Generation
  await test('AI Auto-Reply Draft Generation', async () => {
    const draft = await generateAutoReplyDraft(
      'Our payment gateway is throwing HTTP 500 errors',
      'Technical Issue',
      'Frustrated'
    );
    assert(typeof draft === 'string', 'Draft must be a string');
    assert(draft.length > 20, 'Draft should be substantial');
    assert(draft.includes('Technical Issue') || draft.includes('ZenFlow'), 'Draft should reference department');
  });

  // Test 9: Ticket Deletion Cleanup
  await test('Ticket Deletion', async () => {
    const res = await Ticket.deleteOne({ _id: createdTicketId });
    assert.strictEqual(res.deletedCount, 1, 'Should delete exactly 1 ticket');
    const check = await Ticket.findById(createdTicketId);
    assert.strictEqual(check, null, 'Deleted ticket should no longer exist');
  });

  console.log('='.repeat(65));
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('='.repeat(65));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
