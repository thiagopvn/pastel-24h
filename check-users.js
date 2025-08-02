import { db } from "./server/db.js";
import { users } from "./shared/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function checkUsers() {
  console.log("Checking all users in database...\n");
  
  const allUsers = await db.select().from(users);
  
  for (const user of allUsers) {
    console.log(`User: ${user.email}`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Password length: ${user.password.length}`);
    console.log(`  Password format:`);
    console.log(`    - Starts with $2b$ (bcrypt): ${user.password.startsWith('$2b$')}`);
    console.log(`    - Starts with $scrypt$: ${user.password.startsWith('$scrypt$')}`);
    console.log(`    - First 10 chars: ${user.password.substring(0, 10)}`);
    
    // Test if it's a plain text password
    if (!user.password.startsWith('$') && user.password.length < 30) {
      console.log(`  ⚠️  WARNING: This might be a plain text password!`);
      
      // Optionally fix it
      const shouldFix = process.argv[2] === '--fix';
      if (shouldFix) {
        console.log(`  🔧 Fixing: Hashing password...`);
        const hashedPassword = await bcrypt.hash(user.password, 12);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id));
        console.log(`  ✅ Password has been hashed`);
      }
    }
    
    console.log("");
  }
  
  if (process.argv[2] !== '--fix') {
    console.log("\nTo fix plain text passwords, run: node check-users.js --fix");
  }
  
  process.exit(0);
}

checkUsers().catch(console.error);