// Single source of truth for every role workspace: URL slug, labels, left-nav items,
// and whether the role gets the AI assistant. Keys match backend RoleName values.
//
// This drives UX only (which tiles, which nav links). The backend independently
// enforces every permission — never treat anything here as a security check.

import {
  LayoutDashboard, Ship, ShieldCheck, Anchor, Briefcase, ChartColumn, ServerCog,
  Package, FilePlus, ClipboardList, Users, Workflow, Activity, ScrollText, HeartPulse,
} from 'lucide-react'

export const ROLES = {
  shipping_agent: {
    slug: 'shipping',
    label: 'Shipping Agent',
    tagline: 'Submit shipments, upload documents, follow AI processing.',
    suggestedQuestions: ["Which of my shipments are still processing?", "What documents do I still need to upload?"],
    icon: Ship,
    hasAssistant: true,
    nav: [
      { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: 'shipments', label: 'Shipments', icon: Package },
      { path: 'submit', label: 'Submit Shipment', icon: FilePlus },
    ],
  },
  customs_officer: {
    slug: 'customs',
    label: 'Customs Officer',
    tagline: 'Review escalations, evidence and risk findings.',
    suggestedQuestions: ["What's pending in my review queue?", "Explain why a shipment was escalated."],
    icon: ShieldCheck,
    hasAssistant: true,
    nav: [
      { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: 'review-queue', label: 'Review Queue', icon: ClipboardList },
      { path: 'shipments', label: 'Shipments', icon: Package },
    ],
  },
  port_operations: {
    slug: 'port',
    label: 'Port Operations',
    tagline: 'Monitor vessels, arrivals and scheduling.',
    suggestedQuestions: ["What's the current congestion outlook?", "Which vessels are arriving soon?"],
    icon: Anchor,
    hasAssistant: true,
    nav: [
      { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: 'vessels', label: 'Vessels', icon: Ship },
      { path: 'shipments', label: 'Shipments', icon: Package },
    ],
  },
  importer_exporter: {
    slug: 'importer',
    label: 'Importer / Exporter',
    tagline: 'Track your own shipments and their status.',
    suggestedQuestions: ["Where are my shipments right now?", "Are any of my documents outstanding?"],
    icon: Briefcase,
    hasAssistant: true,
    nav: [
      { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: 'shipments', label: 'My Shipments', icon: Package },
    ],
  },
  management: {
    slug: 'management',
    label: 'Management',
    tagline: 'Aggregate KPIs, trends and risk summaries.',
    suggestedQuestions: ["What's our current congestion trend?", "Summarise risk across recent shipments."],
    icon: ChartColumn,
    hasAssistant: true,
    nav: [
      { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: 'analytics', label: 'Analytics', icon: ChartColumn },
    ],
  },
  admin: {
    slug: 'admin',
    label: 'System Administrator',
    tagline: 'Users, workflows, agent runs and system health.',
    icon: ServerCog,
    hasAssistant: false, // by design: admin has no chatbot
    nav: [
      { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: 'users', label: 'Users', icon: Users },
      { path: 'workflows', label: 'Workflows', icon: Workflow },
      { path: 'agent-runs', label: 'Agent Runs', icon: Activity },
      { path: 'audit', label: 'Audit Log', icon: ScrollText },
      { path: 'system-health', label: 'System Health', icon: HeartPulse },
    ],
  },
}

export const ROLE_KEYS = Object.keys(ROLES)

export const roleBySlug = (slug) => ROLE_KEYS.find((k) => ROLES[k].slug === slug)

export const dashboardPathFor = (roleKey) =>
  ROLES[roleKey] ? `/app/${ROLES[roleKey].slug}/dashboard` : '/login'
