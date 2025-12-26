// Creates the first administrator (use this instead of demo data in production).
//
//   npm run create-admin -- you@company.com "Your Name"
//   (it asks for a password; or set ADMIN_PASSWORD in the environment)
//
// If the email already exists, that account is promoted to ADMIN and its password is not changed.
import './_db.ts';
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { connectDB, disconnectDB } from '../src/db.ts';
import { UserModel } from '../src/models/index.ts';

const [email, ...nameParts] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const fullName = nameParts.join(' ').trim() || 'Administrator';

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run create-admin -- you@company.com "Your Name"');
  process.exit(1);
}

try {
  await connectDB();
  const cleanEmail = email.trim().toLowerCase();
  const existing = await UserModel.findOne({ email: cleanEmail });

  if (existing) {
    existing.role = 'ADMIN';
    await existing.save();
    console.log(`${cleanEmail} already existed and is now an ADMIN (password unchanged).`);
  } else {
    let password = process.env.ADMIN_PASSWORD || '';
    if (!password) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      password = await rl.question('Password for the new admin (at least 12 characters): ');
      rl.close();
    }
    if (password.length < 12) {
      console.error('The password must be at least 12 characters long.');
      process.exit(1);
    }
    await UserModel.create({
      email: cleanEmail,
      fullName,
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(password, 12),
    });
    console.log(`Admin ${cleanEmail} created. You can log in now.`);
  }
} catch (err) {
  console.error('Could not create the admin:', err);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
