import Database from 'better-sqlite3';
import assert from 'node:assert/strict';

try {
  const db = new Database('./data/local.db');

  // Fetch the most recent closed shift
  const shift = db
    .prepare(`
      SELECT
        s.*,
        u.name as user_name,
        u.email as user_email
      FROM shifts s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.status = 'closed'
      ORDER BY s.end_time DESC
      LIMIT 1
    `)
    .get();

  assert.ok(shift, 'Expected a closed shift');

  // Records associated with the shift
  const records = db
    .prepare(`
      SELECT
        sr.*,
        p.name as product_name,
        p.price as product_price,
        p.category as product_category
      FROM shift_records sr
      LEFT JOIN products p ON sr.product_id = p.id
      WHERE sr.shift_id = ?
    `)
    .all(shift.id);

  assert.ok(Array.isArray(records), 'Records should be an array');
  records.forEach((r) => assert.strictEqual(r.shift_id, shift.id));

  // Payments associated with the shift
  const payments = db
    .prepare(`SELECT * FROM shift_payments WHERE shift_id = ?`)
    .get(shift.id);
  assert.ok(payments, 'Expected payments object');
  assert.strictEqual(payments.shift_id, shift.id);

  // Corrections for the shift
  const corrections = db
    .prepare(`SELECT * FROM corrections WHERE shift_id = ? AND revoked_at IS NULL`)
    .all(shift.id);
  assert.ok(Array.isArray(corrections), 'Corrections should be an array');
  corrections.forEach((c) => assert.strictEqual(c.shift_id, shift.id));

  // Cash adjustments
  const adjustments = db
    .prepare(`SELECT * FROM cash_adjustments WHERE shift_id = ?`)
    .all(shift.id);
  assert.ok(Array.isArray(adjustments), 'Adjustments should be an array');
  adjustments.forEach((a) => assert.strictEqual(a.shift_id, shift.id));

  db.close();
} catch (err) {
  console.error('Assertion failed:', err);
  process.exit(1);
}
