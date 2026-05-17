import { Home, User, Bell, Users, Music, Calendar, Play, BarChart3, HelpCircle, LogOut, Headphones, MessageCircle, RefreshCw, RotateCcw, RotateCw, Mic, Film, Shield, Crown } from 'lucide-react'

export type MenuItem = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  href?: string
  badge?: boolean | null
  onClick?: () => void
  coordinatorOnly?: boolean
  bossOnly?: boolean
}

// Shared menu items used across all pages
export const getMenuItems = (onLogout?: () => void, onRefresh?: () => void, isCoordinator?: boolean, isBoss?: boolean): MenuItem[] => [

  {
    icon: Home,
    title: 'Home',
    href: '/home',
    badge: null,
  },

  {
    icon: User,
    title: 'Profile',
    href: '/pages/profile',
    badge: null,
  },
  {
    icon: Crown,
    title: 'Subscription',
    href: '/subscription',
    badge: null,
  },
  ...(isCoordinator ? [{
    icon: Shield,
    title: 'Admin Panel',
    href: '/admin',
    badge: null,
    coordinatorOnly: true,
  }] : []),
  ...(isBoss ? [{
    icon: Crown,
    title: 'Central Admin',
    href: '/boss',
    badge: null,
    bossOnly: true,
  }] : []),
  {
    icon: Bell,
    title: 'Notifications',
    href: '/pages/notifications',
    badge: true,
  },
  {
    icon: Users,
    title: 'Groups',
    href: '/pages/groups',
    badge: null,
  },
  {
    icon: Film,
    title: 'Media',
    href: '/pages/media',
    badge: null,
  },
  {
    icon: Music,
    title: 'Submit Song',
    href: '/pages/submit-song',
    badge: null,
  },
  {
    icon: Calendar,
    title: 'Rehearsals',
    href: '/pages/rehearsals',
    badge: null,
  },
  {
    icon: Calendar,
    title: 'Ministry Calendar',
    href: '/pages/calendar',
    badge: null,
  },

  {
    icon: HelpCircle,
    title: 'Admin Support',
    href: '/pages/support',
    badge: null,
  },
  {
    icon: RotateCw,
    title: 'Refresh App',
    badge: null,
    onClick: onRefresh || (() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }),
  },
  {
    icon: LogOut,
    title: 'Logout',
    badge: null,
    onClick: onLogout || (() => {
      // No hard redirect - let the app handle it
    }),
  },
]
// bro ha laoding program daa is o slow ver slow wh i hough is mean o be insan and a;lso he song card is no showing he rehearsal coun updae i is working bu is no showing he updae check if i is geing he rehearsal coun well from he meadaa spli or rimem
