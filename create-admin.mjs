import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';

async function createAdmin() {
  const db = new Database('./data/local.db');
  
  // Check if admin exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@test.com');
  
  if (!existing) {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const stmt = db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)');
    stmt.run('admin@test.com', hashedPassword, 'Admin', 'admin');
    console.log('Admin user created');
  } else {
    console.log('Admin user already exists with ID:', existing.id);
  }
  
  // Show all users
  const users = db.prepare('SELECT id, email, role FROM users').all();
  console.log('All users:', users);
  
  // Check last closed shift
  const lastShift = db.prepare('SELECT id, status, final_cash, cash_for_next_shift FROM shifts WHERE status = ? ORDER BY end_time DESC LIMIT 1').get('closed');
  console.log('Last closed shift:', lastShift);
  
  db.close();
}

createAdmin().catch(console.error);