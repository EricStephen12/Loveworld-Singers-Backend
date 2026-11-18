require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY;
const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://loveworld-singers-app-default-rtdb.firebaseio.com';

if (!admin.apps.length) {
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      databaseURL
    });
  } else {
    console.error('Error: Firebase Admin credentials missing in .env.local');
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

async function createAccount() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('Usage: node scripts/create-account.js <email> <password> <zoneIdOrName> [firstName] [lastName] [role]');
    process.exit(1);
  }

  const [email, password, zoneInput, firstName = '', lastName = '', role = 'member'] = args;

  try {
    console.log(`Creating user account for ${email}...`);
    
    // Create Firebase Auth User
    const displayName = `${firstName} ${lastName}`.trim() || email.split('@')[0];
    const userRecord = await auth.createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName,
      emailVerified: true
    });

    console.log(`Auth user created successfully! UID: ${userRecord.uid}`);

    // Create Firestore Profile
    const profileData = {
      id: userRecord.uid,
      email: email.trim().toLowerCase(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      display_name: displayName,
      zone_id: zoneInput,
      zone_name: zoneInput,
      role: role,
      administration: role === 'coordinator' ? 'Coordinator' : 'Member',
      profile_completed: true,
      is_active: true,
      can_access_pre_rehearsal: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.collection('profiles').doc(userRecord.uid).set(profileData);
    console.log(`Profile created in Firestore collection 'profiles'!`);
    console.log('ACCOUNT CREATION SUCCESSFUL:', JSON.stringify(profileData, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Failed to create account:', err.message);
    process.exit(1);
  }
}

createAccount();
