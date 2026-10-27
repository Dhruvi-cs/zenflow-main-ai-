// testing/test_e2e_journeys.js - End-to-End User Journey Verification for ZenFlow
const assert = require('assert');
const Ticket = require('../models/Ticket');
const { getDashboardMetrics } = require('../controllers/ticketController');

async function runE2EJourneys() {
  console.log('='.repeat(70));
  console.log('🌐 PHASE 5: END-TO-END USER JOURNEY VERIFICATION');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  async function step(journeyId, name, fn) {
    try {
      process.stdout.write(`• [${journeyId}] ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
    }
  }

  let journeyTicketId = null;

  // Journey 1: Customer Ticket Submission & Deflection Workflow
  await step('EJ-01', 'Journey C: Customer submits ticket and accepts automated deflection', async () => {
    // 1. Submit ticket
    const ticket = new Ticket({
      title: 'How do I reset my password?',
      description: 'Locked out of enterprise account.',
      category: 'Account',
      priority: 'Medium',
      customerName: 'Dhruvi Shri',
      customerEmail: 'dhruvi@zenflow.ai',
      status: 'Open'
    });
    const saved = await ticket.save();
    journeyTicketId = saved._id;
    assert(saved._id, 'Ticket submitted successfully');

    // 2. Accept deflection
    const deflected = await Ticket.findByIdAndUpdate(
      journeyTicketId,
      { status: 'Deflected', isDeflected: true, solutionAccepted: true },
      { new: true }
    );
    assert.strictEqual(deflected.status, 'Deflected');
    assert.strictEqual(deflected.isDeflected, true);
  });

  // Journey 2: IT Support Ticket Lifecycle & Escalation
  let escalatedTicketId = null;
  await step('EJ-02', 'Journey B: IT Support ticket escalation and manual resolution lifecycle', async () => {
    // 1. Create complex issue ticket
    const t = new Ticket({
      title: 'Database replica synchronization failure',
      description: 'Nodes 2 and 3 desynchronized during automated migration.',
      category: 'Technical Issue',
      priority: 'High',
      status: 'Open'
    });
    const created = await t.save();
    escalatedTicketId = created._id;

    // 2. Transition to In-Progress
    const inProgress = await Ticket.findByIdAndUpdate(
      escalatedTicketId,
      { status: 'In-Progress', assignedAgent: 'Senior Ops Engineer' },
      { new: true }
    );
    assert.strictEqual(inProgress.status, 'In-Progress');
    assert.strictEqual(inProgress.assignedAgent, 'Senior Ops Engineer');

    // 3. Mark Resolved
    const resolved = await Ticket.findByIdAndUpdate(
      escalatedTicketId,
      { status: 'Resolved' },
      { new: true }
    );
    assert.strictEqual(resolved.status, 'Resolved');
  });

  // Journey 3: Real-Time Ticket Room Collaboration Session
  await step('EJ-03', 'Journey E: Real-time agent collaboration chat messages in ticket room', async () => {
    const ticket = await Ticket.findById(escalatedTicketId);
    ticket.messages.push({
      sender: 'Dhruvi Shri',
      text: 'Replica lag has returned to 0ms after manual sync.',
      timestamp: new Date().toISOString()
    });
    ticket.messages.push({
      sender: 'Senior Ops Engineer',
      text: 'Verified. Marking ticket as resolved.',
      timestamp: new Date().toISOString()
    });
    const saved = await ticket.save();
    assert.strictEqual(saved.messages.length, 2);
    assert.strictEqual(saved.messages[1].sender, 'Senior Ops Engineer');
  });

  // Journey 4: Operations Dashboard Telemetry & KPI Calculations
  await step('EJ-04', 'Telemetry: Live KPI metrics aggregation calculation', async () => {
    let mockReq = {};
    let metricsData = null;
    let mockRes = {
      json: (data) => { metricsData = data; return mockRes; },
      status: () => mockRes
    };

    await getDashboardMetrics(mockReq, mockRes);
    assert(metricsData, 'Dashboard metrics must return data object');
    assert(typeof metricsData.stats.total === 'number');
    assert(typeof metricsData.stats.deflectionRate === 'string');
    assert(metricsData.stats.total >= 2, 'Total tickets should reflect active database entries');
  });

  // Cleanup journey tickets
  await Ticket.findByIdAndDelete(journeyTicketId);
  await Ticket.findByIdAndDelete(escalatedTicketId);

  console.log('='.repeat(70));
  console.log(`JOURNEY AUDIT SUMMARY: ${passed} PASSED | ${failed} FAILED (Total: ${passed + failed})`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runE2EJourneys().catch(err => {
  console.error('E2E Runner Failure:', err);
  process.exit(1);
});
