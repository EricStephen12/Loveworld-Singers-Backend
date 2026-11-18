import { NextRequest, NextResponse } from 'next/server'
import { auth as adminAuth, db } from '@/lib/firebase-admin'
import { verifyFirebaseIdToken } from '@/lib/api-guards'
import { isHQAdminEmail } from '@/config/roles'
import { ZONES, getZoneById, getZoneByInvitationCode, getZoneBySlug } from '@/config/zones'

/**
 * ADMIN CREATE USER API
 * Creates a new user in Firebase Auth and populates their Firestore profile.
 * Requires HQ Admin authentication token OR valid internal API key.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      firstName = '',
      lastName = '',
      zoneId,
      zoneCode,
      zoneName,
      role,
      administration,
      phone = ''
    } = body

    // 1. Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      )
    }

    // 2. Authorization check (HQ Admin token or internal key)
    const internalKey = request.headers.get('x-internal-api-key')
    const expectedKey = process.env.INTERNAL_API_KEY || 'lwsrh_production_secure_api_key_2026_x9z2'
    const isInternalAuthorized = internalKey === expectedKey

    if (!isInternalAuthorized) {
      const caller = await verifyFirebaseIdToken(request)
      const callerEmail = caller?.email
      if (!caller || !callerEmail || !isHQAdminEmail(callerEmail)) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized. HQ Admin access or valid Internal API key required.' },
          { status: 403 }
        )
      }
    }

    // 3. Resolve Zone Information
    let targetZone = null
    if (zoneId) {
      targetZone = getZoneById(zoneId) || ZONES.find(z => z.id.toLowerCase() === zoneId.toLowerCase())
    }
    if (!targetZone && zoneCode) {
      targetZone = getZoneByInvitationCode(zoneCode)
    }
    if (!targetZone && zoneName) {
      const searchName = zoneName.toLowerCase().trim()
      targetZone = ZONES.find(
        z => z.name.toLowerCase() === searchName ||
             z.slug.toLowerCase() === searchName ||
             z.name.toLowerCase().includes(searchName)
      )
    }

    // Default to HQ main zone if not specified/found
    if (!targetZone) {
      targetZone = ZONES[0] // Your Loveworld Singers (HQ)
    }

    const displayName = `${firstName} ${lastName}`.trim() || email.split('@')[0]
    const userRole = role || (targetZone.id === 'zone-boss' ? 'boss' : 'member')
    const userAdminLevel = administration || (userRole === 'coordinator' ? 'Coordinator' : 'Member')

    // 4. Create User in Firebase Auth using Admin SDK
    const userRecord = await adminAuth.createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName,
      emailVerified: true
    })

    // 5. Create Profile Document in Firestore
    const profileData = {
      id: userRecord.uid,
      email: email.trim().toLowerCase(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      display_name: displayName,
      phone_number: phone.trim(),
      phone: phone.trim(),
      zone_id: targetZone.id,
      zone_name: targetZone.name,
      zone_region: targetZone.region,
      role: userRole,
      administration: userAdminLevel,
      profile_completed: true,
      is_active: true,
      can_access_pre_rehearsal: true,
      has_hq_access: targetZone.region === 'Headquarters',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    await db.collection('profiles').doc(userRecord.uid).set(profileData)

    return NextResponse.json({
      success: true,
      message: `Account created successfully for ${email}`,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        zone: {
          id: targetZone.id,
          name: targetZone.name,
          region: targetZone.region
        },
        role: userRole,
        administration: userAdminLevel
      }
    })

  } catch (error: any) {
    console.error('[AdminCreateUser] API Error:', error)
    
    // Handle Firebase Auth error codes cleanly
    let errorMessage = error.message || 'Failed to create user account'
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'An account with this email address already exists.'
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'The provided email address is invalid.'
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'The password must be at least 6 characters long.'
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
