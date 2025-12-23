import 'dotenv/config';

/** Refuse to touch a real (Atlas / remote) database unless the person typed --yes. */
export function requireConfirmationForRemote(action: string, mode: string | null) {
  if (mode === 'atlas' && !process.argv.includes('--yes')) {
    console.error(
      `\nRefusing to ${action} the database in MONGODB_URI. This is NOT the built-in local database.\n` +
        'If you are sure, run the same command again and add --yes at the end.\n' +
        'Example:  npm run db:reset -- --yes\n'
    );
    process.exit(1);
  }
}
