import type { LucideIcon } from 'lucide-react-native';
import {
  Plus,
  LayoutDashboard,
  Wrench,
  Cpu,
  Settings,
  Inbox,
  Layers,
  Users,
  AlertOctagon,
  TicketCheck,
  BarChart3,
  Tag,
  Shield,
} from 'lucide-react-native';

import type { UserRole } from '@/types/api';

// Ported verbatim from ../../aes-frontend/src/components/rose/RoseShell.js —
// do not simplify, merge or "improve" any role's items. See CLAUDE.md rule 3.

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface RoleNav {
  primary: NavItem;
  items: NavItem[];
}

export const NAV: Record<UserRole, RoleNav> = {
  CUSTOMER: {
    primary: { href: '/services/installation', label: 'New Service Request', icon: Plus },
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/tickets', label: 'Service Requests', icon: Wrench },
      { href: '/installations', label: 'My Projects', icon: Cpu },
      { href: '/services', label: 'Services', icon: Layers },
      { href: '/account', label: 'Settings', icon: Settings },
    ],
  },
  CRM_AGENT: {
    primary: { href: '/services/ticket', label: 'New Ticket on Behalf', icon: Plus },
    items: [
      { href: '/crm', label: "Today's Pool", icon: Inbox },
      { href: '/tickets', label: 'All Tickets', icon: TicketCheck },
      { href: '/account', label: 'Settings', icon: Settings },
    ],
  },
  OPS_MANAGER: {
    primary: { href: '/services/ticket', label: 'Quick Ticket', icon: Plus },
    items: [
      { href: '/ops', label: 'Triage Board', icon: Inbox },
      { href: '/tickets', label: 'All Tickets', icon: TicketCheck },
      { href: '/account', label: 'Settings', icon: Settings },
    ],
  },
  SITE_ENGINEER: {
    primary: { href: '/engineer', label: 'My Schedule', icon: Plus },
    items: [
      { href: '/engineer', label: 'My Jobs', icon: Wrench },
      { href: '/tickets', label: 'All Tickets', icon: TicketCheck },
      { href: '/account', label: 'Settings', icon: Settings },
    ],
  },
  SERVICE_MANAGER: {
    primary: { href: '/admin', label: 'Escalation Triage', icon: Plus },
    items: [
      { href: '/admin', label: 'Escalations', icon: AlertOctagon },
      { href: '/crm', label: 'CRM View', icon: Users },
      { href: '/tickets', label: 'All Tickets', icon: TicketCheck },
      { href: '/account', label: 'Settings', icon: Settings },
    ],
  },
  ADMIN: {
    primary: { href: '/admin', label: 'Operations Triage', icon: Plus },
    items: [
      { href: '/admin', label: 'Escalations', icon: AlertOctagon },
      { href: '/crm', label: 'CRM View', icon: Users },
      { href: '/admin/coupons', label: 'Coupons', icon: Tag },
      { href: '/admin/revenue', label: 'Revenue', icon: BarChart3 },
      { href: '/account', label: 'Settings', icon: Settings },
    ],
  },
  SUPER_ADMIN: {
    primary: { href: '/admin/revenue', label: 'Revenue HQ', icon: Plus },
    items: [
      { href: '/admin/revenue', label: 'Revenue', icon: BarChart3 },
      { href: '/admin', label: 'Operations', icon: Shield },
      { href: '/crm', label: 'CRM View', icon: Users },
      { href: '/admin/coupons', label: 'Coupons', icon: Tag },
      { href: '/account', label: 'Settings', icon: Settings },
    ],
  },
};

// Ported verbatim from RoseShell.js ROUTE_LABELS — drives breadcrumb labels.
export const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  tickets: 'Service Requests',
  installations: 'My Projects',
  services: 'Services',
  ticket: 'New Ticket',
  installation: 'New Installation',
  select: 'Select Service',
  account: 'Settings',
  notifications: 'Notifications',
  crm: 'CRM Pool',
  ops: 'Triage Board',
  engineer: 'My Jobs',
  admin: 'Operations',
  revenue: 'Revenue',
  coupons: 'Coupons',
  quotes: 'Quotes',
  amc: 'AMC',
  products: 'Products',
};

export interface Crumb {
  href: string;
  label: string;
}

// Ported verbatim from RoseShell.js buildBreadcrumbs(). e.g.
// /tickets/TKT-2026-1042 →
//   [{ href: '/tickets', label: 'Service Requests' },
//    { href: '/tickets/TKT-2026-1042', label: 'TKT-2026-1042' }]
export function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = (pathname || '/').split('/').filter(Boolean);
  const crumbs: Crumb[] = [];
  let path = '';
  for (const seg of segments) {
    path = `${path}/${seg}`;
    crumbs.push({ href: path, label: ROUTE_LABELS[seg] || seg });
  }
  return crumbs;
}

// Ported verbatim from RoseShell.js isActive() — including its quirk:
// '/admin' is active for '/admin/*' EXCEPT '/admin/revenue' and '/admin/coupons'.
export function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/admin') {
    return (
      pathname === '/admin'
      || (pathname.startsWith('/admin/')
        && !pathname.startsWith('/admin/revenue')
        && !pathname.startsWith('/admin/coupons'))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function initialsForName(name: string | undefined): string {
  const source = name || 'User';
  const initials = source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
  return initials || 'U';
}
