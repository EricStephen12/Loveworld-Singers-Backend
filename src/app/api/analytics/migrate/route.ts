import { NextRequest, NextResponse } from 'next/server'
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter
} from 'firebase/firestore'
import { db } from '@/lib/firebase-setup'

interface MonthlySummary {
  year: number
  month: number
  totalEvents: number
  totalSignups: number
  totalLogins: number
  totalFeatureEngagements: number
  uniqueUsers: number
  pageViews: { [page: string]: number }
  countries: { [country: string]: number }
  cities: { [city: string]: number }
  browsers: { [browser: string]: number }
  featureEngagements: { [feature: string]: number }
  userIds: { [userId: string]: boolean } // Track unique user IDs
  updatedAt: Date
  createdAt: Date
}

function getMonthlyDocId(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function createEmptySummary(year: number, month: number): MonthlySummary {
  return {
    year,
    month,
    totalEvents: 0,
    totalSignups: 0,
    totalLogins: 0,
    totalFeatureEngagements: 0,
    uniqueUsers: 0,
    pageViews: {},
    countries: {},
    cities: {},
    browsers: {},
    featureEngagements: {},
    userIds: {}, // Track unique users
    updatedAt: new Date(),
    createdAt: new Date()
  }
}

// Get month boundaries for a specific year/month
function getMonthBoundaries(year: number, month: number) {
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return {
    start: startDate.getTime(),
    end: endDate.getTime()
  }
}

// Process a single month's data - THE BIG COMPANY WAY
async function processMonth(year: number, month: number): Promise<{
  events: number
  signups: number
  logins: number
  featureEngagements: number
  summary: MonthlySummary
}> {
  const docId = getMonthlyDocId(year, month)
  const docRef = doc(db, 'analytics_monthly', docId)
  const { start, end } = getMonthBoundaries(year, month)
  
  // Get existing summary or create new
  const existingDoc = await getDoc(docRef)
  const summary: MonthlySummary = existingDoc.exists() 
    ? existingDoc.data() as MonthlySummary
    : createEmptySummary(year, month)
  
  let eventsProcessed = 0
  let signupsProcessed = 0
  let loginsProcessed = 0
  let featureEngagementsProcessed = 0
  const BATCH_SIZE = 500
  
  // Reset counts for fresh aggregation of this month
  summary.totalEvents = 0
  summary.totalSignups = 0
  summary.totalLogins = 0
  summary.totalFeatureEngagements = 0
  summary.uniqueUsers = 0
  summary.pageViews = {}
  summary.countries = {}
  summary.cities = {}
  summary.browsers = {}
  summary.featureEngagements = {}
  summary.userIds = {} // Reset unique users tracking
  
  // Process EVENTS for this month only (time-bounded query)
  let lastEventDoc: any = null
  let hasMoreEvents = true
  
  while (hasMoreEvents) {
    let eventsQuery = lastEventDoc
      ? query(
          collection(db, 'analytics_events'),
          where('timestamp', '>=', start),
          where('timestamp', '<=', end),
          orderBy('timestamp', 'asc'),
          startAfter(lastEventDoc),
          limit(BATCH_SIZE)
        )
      : query(
          collection(db, 'analytics_events'),
          where('timestamp', '>=', start),
          where('timestamp', '<=', end),
          orderBy('timestamp', 'asc'),
          limit(BATCH_SIZE)
        )
    
    const eventsSnapshot = await getDocs(eventsQuery)
    
    if (eventsSnapshot.docs.length === 0) {
      hasMoreEvents = false
      break
    }
    
    for (const docSnap of eventsSnapshot.docs) {
      const event = docSnap.data()
      summary.totalEvents++
      eventsProcessed++
      
      // Track unique users by userId
      if (event.userId && !summary.userIds[event.userId]) {
        summary.userIds[event.userId] = true
      }
      
      // Process different event types
      switch (event.type) {
        case 'signup':
          summary.totalSignups++
          signupsProcessed++
          break
        case 'login':
          summary.totalLogins++
          loginsProcessed++
          break
        case 'feature_engagement':
          summary.totalFeatureEngagements++
          featureEngagementsProcessed++
          
          // Track page views
          if (event.page) {
            const pageKey = String(event.page).replace(/\//g, '_').replace(/\./g, '_')
            summary.pageViews[pageKey] = (summary.pageViews[pageKey] || 0) + 1
          }
          
          // Track feature engagements
          if (event.featureName) {
            const featureKey = String(event.featureName).replace(/\//g, '_').replace(/\./g, '_')
            summary.featureEngagements[featureKey] = (summary.featureEngagements[featureKey] || 0) + 1
          }
          break
      }
      
      // Track geography
      if (event.country) {
        const countryKey = String(event.country).replace(/\./g, '_').replace(/\//g, '_')
        summary.countries[countryKey] = (summary.countries[countryKey] || 0) + 1
      }
      if (event.city) {
        const cityKey = String(event.city).replace(/\./g, '_').replace(/\//g, '_')
        summary.cities[cityKey] = (summary.cities[cityKey] || 0) + 1
      }
      
      // Track browser
      if (event.browser) {
        const browserKey = String(event.browser).replace(/\./g, '_').replace(/\//g, '_')
        summary.browsers[browserKey] = (summary.browsers[browserKey] || 0) + 1
      }
    }
    
    lastEventDoc = eventsSnapshot.docs[eventsSnapshot.docs.length - 1]
    if (eventsSnapshot.docs.length < BATCH_SIZE) hasMoreEvents = false
  }
  
  // Calculate unique users count from the userIds map
  summary.uniqueUsers = Object.keys(summary.userIds).length
  
    summary.updatedAt = new Date()
  
  // Save the monthly summary (don't save the full userIds map to save space, just the count)
  const summaryToSave = {
    ...summary,
    userIds: {}   }
  await setDoc(docRef, summaryToSave)
  
  return { 
    events: eventsProcessed, 
    signups: signupsProcessed, 
    logins: loginsProcessed, 
    featureEngagements: featureEngagementsProcessed, 
    summary 
  }
}

// POST: Process a specific month OR auto-detect months to process
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { year, month, autoDetect } = body
    
    // If specific month provided, process just that month
    if (typeof year === 'number' && typeof month === 'number') {
      const result = await processMonth(year, month)
      
      return NextResponse.json({
        success: true,
        message: `Processed ${getMonthlyDocId(year, month)}`,
        totalEvents: result.events,
        totalSignups: result.signups,
        totalLogins: result.logins,
        totalFeatureEngagements: result.featureEngagements,
        monthsProcessed: 1
      })
    }
    
    // Auto-detect: find all months with data and process them
    if (autoDetect) {
      
      // Get date range from raw data (sample first and last docs)
      const oldestEventQuery = query(
        collection(db, 'analytics_events'),
        orderBy('timestamp', 'asc'),
        limit(1)
      )
      const newestEventQuery = query(
        collection(db, 'analytics_events'),
        orderBy('timestamp', 'desc'),
        limit(1)
      )
      
      const [oldestSnap, newestSnap] = await Promise.all([
        getDocs(oldestEventQuery),
        getDocs(newestEventQuery)
      ])
      
      if (oldestSnap.empty || newestSnap.empty) {
        return NextResponse.json({
          success: true,
          message: 'No analytics data found to process',
          totalEvents: 0,
          totalSessions: 0,
          monthsProcessed: 0
        })
      }
      
      const oldestTimestamp = oldestSnap.docs[0].data().timestamp
      const newestTimestamp = newestSnap.docs[0].data().timestamp
      
      const startDate = new Date(oldestTimestamp)
      const endDate = new Date(newestTimestamp)
      
      // Generate list of months to process
      const monthsToProcess: { year: number; month: number }[] = []
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
      
      while (current <= endDate) {
        monthsToProcess.push({ year: current.getFullYear(), month: current.getMonth() })
        current.setMonth(current.getMonth() + 1)
      }
      
      
      // Process each month sequentially (prevents memory overload)
      let totalEvents = 0
      let totalSignups = 0
      let totalLogins = 0
      let totalFeatureEngagements = 0
      const processedMonths: string[] = []
      
      for (const { year: y, month: m } of monthsToProcess) {
        const result = await processMonth(y, m)
        totalEvents += result.events
        totalSignups += result.signups
        totalLogins += result.logins
        totalFeatureEngagements += result.featureEngagements
        processedMonths.push(getMonthlyDocId(y, m))
      }
      
      return NextResponse.json({
        success: true,
        message: `Processed ${monthsToProcess.length} months`,
        totalEvents,
        totalSignups,
        totalLogins,
        totalFeatureEngagements,
        monthsProcessed: monthsToProcess.length,
        months: processedMonths
      })
    }
    
    // Default: process current month only
    const now = new Date()
    const result = await processMonth(now.getFullYear(), now.getMonth())
    
    return NextResponse.json({
      success: true,
      message: `Processed current month`,
      totalEvents: result.events,
      totalSignups: result.signups,
      totalLogins: result.logins,
      totalFeatureEngagements: result.featureEngagements,
      monthsProcessed: 1
    })
    
  } catch (error) {
 console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Check migration status and available summaries
export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, 'analytics_monthly'))
    const summaries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return NextResponse.json({
      success: true,
      count: summaries.length,
      summaries: summaries.map(s => ({
        id: s.id,
        totalEvents: (s as any).totalEvents,
        totalSignups: (s as any).totalSignups,
        totalLogins: (s as any).totalLogins,
        totalFeatureEngagements: (s as any).totalFeatureEngagements,
        updatedAt: (s as any).updatedAt
      }))
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
