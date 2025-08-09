import Database from 'better-sqlite3';

const db = new Database('./data/local.db');

// Test basic query
const shifts = db.prepare(`
  SELECT 
    s.*,
    u.name as user_name,
    u.email as user_email
  FROM shifts s
  LEFT JOIN users u ON s.user_id = u.id
  WHERE s.status = 'closed'
  ORDER BY s.end_time DESC
  LIMIT 1
`).get();

console.log('Last closed shift:', shifts);

if (shifts) {
  // Get records for this shift
  const records = db.prepare(`
    SELECT 
      sr.*,
      p.name as product_name,
      p.price as product_price,
      p.category as product_category
    FROM shift_records sr
    LEFT JOIN products p ON sr.product_id = p.id
    WHERE sr.shift_id = ?
  `).all(shifts.id);

  console.log('Records:', records);

  // Get payments for this shift
  const payments = db.prepare(`
    SELECT * FROM shift_payments WHERE shift_id = ?
  `).get(shifts.id);

  console.log('Payments:', payments);

  // Get corrections for this shift
  const corrections = db.prepare(`
    SELECT * FROM corrections WHERE shift_id = ? AND revoked_at IS NULL
  `).all(shifts.id);

  console.log('Corrections:', corrections);

  // Get cash adjustments
  const adjustments = db.prepare(`
    SELECT * FROM cash_adjustments WHERE shift_id = ?
  `).all(shifts.id);

  console.log('Adjustments:', adjustments);
}

db.close();