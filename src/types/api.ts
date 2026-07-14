/**
 * API response/enum types — mirrors ../../aes-backend-node/src/types/response
 * and ../../aes-backend-node/src/enums exactly. Field names are copied
 * verbatim; a mismatch here silently renders `undefined` on screen.
 */

// ─── Enums (backend src/enums/*.ts) ────────────────────────────────────────
export type UserRole =
  | 'CUSTOMER'
  | 'OPS_MANAGER'
  | 'CRM_AGENT'
  | 'SITE_ENGINEER'
  | 'SERVICE_MANAGER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type AcType = 'SPLIT' | 'CASSETTE' | 'CENTRAL' | 'VRF_VRV' | 'WINDOW' | 'PORTABLE';

export type TimeSlot = 'EARLY' | 'MORNING' | 'AFTERNOON' | 'EVENING';

export type PropertyType =
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'INDUSTRIAL'
  | 'HOSPITAL'
  | 'HOTEL'
  | 'INSTITUTIONAL';

export type WarrantyStatus = 'IN_WARRANTY' | 'EXPIRED' | 'UNKNOWN';
export type ServiceStatus = 'P1_AMC' | 'P2_WARRANTY' | 'P3_PAID';
export type ServiceType = 'AMC' | 'WARRANTY' | 'PAID';
export type Priority = 'P1' | 'P2' | 'P3';

export type ProblemCategory =
  | 'NOT_COOLING'
  | 'NOISE'
  | 'LEAKING'
  | 'NOT_TURNING_ON'
  | 'NO_AIRFLOW'
  | 'REMOTE_WIFI'
  | 'SMELL_BURNING'
  | 'OTHER';

export type TicketStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'NEW'
  | 'OFFERED_CRM'
  | 'ENGINEER_OFFERED'
  | 'EN_ROUTE'
  | 'ON_SITE'
  | 'WAITING_PART'
  | 'WAITING_CUSTOMER_APPROVAL'
  | 'ESCALATED_BY_CUSTOMER'
  | 'REOPENED';

export type InstallationStatus =
  | 'PENDING'
  | 'NEW'
  | 'OFFERED_CRM'
  | 'CONFIRMED'
  | 'SURVEY_SCHEDULED'
  | 'SITE_VISIT_DONE'
  | 'SITE_VISITED'
  | 'QUOTE_DRAFT'
  | 'QUOTE_PENDING_APPROVAL'
  | 'QUOTE_REJECTED_INTERNAL'
  | 'QUOTE_SENT'
  | 'QUOTE_NEGOTIATING'
  | 'QUOTE_ACCEPTED'
  | 'INSTALLATION_SCHEDULED'
  | 'INSTALLATION_IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type QuoteStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED_INTERNAL'
  | 'SENT_TO_CUSTOMER'
  | 'CUSTOMER_ACCEPTED'
  | 'CUSTOMER_REJECTED'
  | 'NEGOTIATING'
  | 'SUPERSEDED';

export type ApprovalBand = 'AUTO' | 'CRM' | 'SERVICE_MANAGER' | 'ADMIN';

export type PartRequestStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ORDERED'
  | 'DELIVERED'
  | 'INSTALLED';

export type OfferType = 'CRM_OWNER' | 'ENGINEER_DISPATCH';
export type OfferMode = 'DIRECT' | 'INVITE';
export type OfferStatus = 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN';

export type NotificationType =
  | 'TICKET_RAISED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_ESCALATED'
  | 'TICKET_RESOLVED'
  | 'AMC_REMINDER'
  | 'INSTALLATION_UPDATE'
  | 'GENERAL'
  | 'AMC_UPGRADE'
  | 'PAYMENT'
  | 'WARRANTY_EXPIRING'
  | 'SYSTEM';

export type ActivityType =
  | 'TICKET_RAISED'
  | 'ASSIGNED'
  | 'ACKNOWLEDGED'
  | 'ESCALATED'
  | 'NOTE_ADDED'
  | 'PHOTO_ADDED'
  | 'STATUS_CHANGED'
  | 'RESOLVED'
  | 'RATED'
  | 'CRM_PICKED'
  | 'ENGINEER_ASSIGNED'
  | 'ENGINEER_ACCEPTED'
  | 'EN_ROUTE'
  | 'ON_SITE'
  | 'IN_PROGRESS'
  | 'PART_REQUESTED'
  | 'PAYMENT_RECEIVED'
  | 'CUSTOMER_ESCALATED'
  | 'ESCALATION_RECEIVED';

export type EscalationType = 'AUTO' | 'MANUAL';

// ─── User / Property / AcUnit ──────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  role: UserRole;
  propertiesCount: number;
  acUnitsCount: number;
  onShift?: boolean;
  branch?: string;
  teamName?: string;
  isTeamLead?: boolean;
}

export interface AcUnit {
  id: string;
  propertyId: string;
  roomLabel: string;
  acType: AcType;
  brand?: string;
  modelNumber?: string;
  tonnage?: number;
  energyStarRating?: number;
  installationDate?: string;
  warrantyExpiry?: string;
  warrantyStatus: WarrantyStatus;
  serviceStatus: ServiceStatus;
  createdAt: string;
  purchasedFromAes?: boolean;
  warrantyStartDate?: string;
  warrantyMonths?: number;
  purchaseInvoiceNo?: string;
  soldPrice?: number;
  warrantyDaysLeft?: number;
  warrantyBadge?: string;
}

export interface Property {
  id: string;
  label: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  pincode?: string;
  propertyType: PropertyType;
  isPrimary?: boolean;
  acUnitsCount: number;
  acUnits?: AcUnit[];
  createdAt: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  landmark?: string;
  googlePlaceId?: string;
  secondaryPhone?: string;
}

// ─── Tickets ────────────────────────────────────────────────────────────
export interface TicketActivity {
  id: string;
  activityType: ActivityType;
  description?: string;
  metadataJson?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
}

export interface EscalationLog {
  id: string;
  ticketNumber?: string;
  fromLevel: number;
  toLevel: number;
  fromUserId?: string;
  fromUserName?: string;
  reason?: string;
  escalationType: EscalationType;
  escalatedAt: string;
}

export interface ServiceTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;

  acUnitId: string;
  acUnitRoom?: string;
  acBrand?: string;
  acModel?: string;
  propertyId?: string;
  propertyLabel?: string;

  priority: Priority;
  serviceType: ServiceType;
  problemCategory: ProblemCategory;
  errorCode?: string;
  problemDescription?: string;
  photosJson?: string;
  scheduledDate: string;
  scheduledSlot: TimeSlot;

  carriedForward: boolean;
  originalScheduledDate?: string;

  assignedTeamName?: string;

  currentLevel?: number;
  currentAssigneeId?: string;
  currentAssigneeName?: string;
  assignedAt?: string;
  engineerId?: string;
  engineerName?: string;

  status: TicketStatus;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;

  slaDeadlineL1?: string;
  slaDeadlineL2?: string;
  slaDeadlineFinal?: string;
  slaRemainingSecondsL1?: number;
  slaRemainingSecondsL2?: number;
  slaRemainingSecondsFinal?: number;
  isL1Breached?: boolean;
  isL2Breached?: boolean;
  isFinalBreached?: boolean;

  estimatedCharge?: number;
  finalCharge?: number;
  chargeAccepted?: boolean;

  customerRating?: number;
  customerFeedback?: string;

  createdAt: string;
  updatedAt: string;

  activities?: TicketActivity[];
  escalationLogs?: EscalationLog[];
}

export interface SlaStatus {
  ticketNumber: string;
  currentLevel: number;
  status: string;
  slaDeadlineL1?: string;
  slaRemainingSecondsL1?: number;
  slaDeadlineL2?: string;
  slaRemainingSecondsL2?: number;
  slaDeadlineFinal?: string;
  slaRemainingSecondsFinal?: number;
  isL1Breached?: boolean;
  isL2Breached?: boolean;
  isFinalBreached?: boolean;
}

// ─── Installations ──────────────────────────────────────────────────────
export interface InstallationRequest {
  id: string;
  requestNumber: string;
  customerId: string;
  propertyId: string;
  propertyLabel?: string;
  propertyAddress?: string;
  acType: AcType;
  brand?: string;
  modelNumber?: string;
  tonnage?: number;
  energyRating?: number;
  roomsJson?: string;
  scheduledDate?: string;
  scheduledSlot?: TimeSlot;
  status: InstallationStatus;
  assignedEngineerName?: string;
  estimatedCost?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Quotes ─────────────────────────────────────────────────────────────
export interface Quote {
  id: string;
  quoteNumber: string;
  version: number;

  installId?: string;
  installNumber?: string;
  ticketId?: string;
  ticketNumber?: string;

  customerId: string;
  customerName?: string;

  lineItemsJson: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  validUntil?: string;

  status: QuoteStatus;
  requiredApprovalBand?: ApprovalBand;

  preparedByName?: string;
  approvedByName?: string;
  approvedAt?: string;
  sentAt?: string;

  customerDecision?: string;
  customerDecidedAt?: string;
  customerResponse?: string;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Part requests ──────────────────────────────────────────────────────
export interface PartRequest {
  id: string;
  ticketId: string;
  ticketNumber?: string;
  requestedById: string;
  requestedByName?: string;
  partName: string;
  quantity: number;
  urgency?: string;
  unitCost?: number;
  totalCost?: number;
  notes?: string;
  status: PartRequestStatus;
  requiredApprovalBand?: ApprovalBand;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedReason?: string;
  expectedDelivery?: string;
  orderedAt?: string;
  deliveredAt?: string;
  installedAt?: string;
  createdAt: string;
}

// ─── AMC ────────────────────────────────────────────────────────────────
export interface AmcVisit {
  id: string;
  visitNumber: number;
  scheduledDate: string;
  scheduledTimeSlot: string;
  actualVisitDate?: string;
  engineerName?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface AmcContract {
  id: string;
  contractNumber: string;
  customerId: string;
  propertyId: string;
  propertyLabel?: string;
  startDate: string;
  endDate: string;
  visitsPerYear: number;
  visitsCompleted: number;
  isActive: boolean;
  assignedEngineerName?: string;
  contractValue?: number;
  notes?: string;
  createdAt: string;
  visits?: AmcVisit[];
}

export interface NextAmcVisit {
  contractNumber: string;
  scheduledDate: string;
  propertyLabel?: string;
}

// ─── Notifications ──────────────────────────────────────────────────────
export interface Notification {
  id: string;
  title: string;
  body?: string;
  type: NotificationType;
  referenceId?: string;
  referenceType?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

// ─── V14 — CRM Dispatch Pool ─────────────────────────────────────────────
export interface CrmPoolResponse {
  tickets: ServiceTicket[];
  currentLoad: number;
  cap: number;
  remaining: number;
}

export interface CrmTeamMember {
  id: string;
  name: string;
  role: UserRole;
  isTeamLead: boolean;
}

export interface CrmTeamEngineerRef {
  id: string;
  name: string;
}

export interface CrmTeam {
  teamName: string;
  members: CrmTeamMember[];
  engineers: CrmTeamEngineerRef[];
  lead: { id: string; name: string } | null;
}

export interface CustomerSearchHit {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
}

export interface CrmDashboardResponse {
  myInboxCount: number;
  criticalCount: number;
  slaBreachCount: number;
  resolvedToday: number;
  avgResponseMinutes: number;
  tickets: ServiceTicket[];
}

// ─── Engineer "my jobs" + dashboard (EngineerDispatchService#getDashboard) ─
export interface EngineerJobDto {
  ticketId: string;
  ticketNumber: string;
  status: TicketStatus;
  priority: Priority;
  problemCategory: ProblemCategory;
  problemDescription?: string;

  customerId: string;
  customerName?: string;
  customerPhone?: string;

  propertyLabel?: string;
  locality?: string;
  branch?: string;

  acBrand?: string;
  acModel?: string;
  acRoomLabel?: string;

  scheduledDate: string;
  scheduledSlot: TimeSlot;

  assignedAt?: string;
  engineerAcceptedAt?: string;
  enRouteAt?: string;
  onSiteAt?: string;
  resolvedAt?: string;
}

export interface EngineerDashboardResponse {
  pendingOffers: number;
  activeJobs: number;
  resolvedToday: number;
  enRoute: number;
  onSite: number;
  offers: AssignmentOffer[];
  jobs: EngineerJobDto[];
  resolvedTodayList: EngineerJobDto[];
}

// ─── Engineer availability / workload board ──────────────────────────────
export interface EngineerAvailability {
  userId: string;
  name: string;
  phoneNumber?: string;
  branch?: string;
  onShift: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  skills: string[];
  localities: string[];
  activeJobs: number;
  pendingOffers: number;
  maxConcurrentLoad: number;
  overloaded: boolean;
  avgResolutionMinutes?: number;
  csatScore?: number;
}

// ─── Assignment offers ──────────────────────────────────────────────────
export interface AssignmentOffer {
  id: string;

  offerType: OfferType;
  mode: OfferMode;

  status: OfferStatus;
  declineReason?: string;
  note?: string;

  ticketNumber?: string;
  ticketId?: string;
  ticketPriority?: Priority;
  ticketProblemCategory?: ProblemCategory;

  installRequestNumber?: string;
  installId?: string;

  customerId?: string;
  customerName?: string;

  offeredToId: string;
  offeredToName?: string;
  offeredToRole?: UserRole;

  offeredById: string;
  offeredByName?: string;
  offeredByRole?: UserRole;

  expiresAt: string;
  secondsUntilExpiry?: number;
  respondedAt?: string;
  createdAt: string;
}

// ─── Discount coupons (admin) — DiscountCouponController#toMap ────────────
export interface DiscountCoupon {
  id: string;
  code: string;
  description: string;
  discountPct: number;
  maxUses: number;
  timesUsed: number;
  validFrom: string;
  validUntil: string;
  appliesTo: string;
  minAmount: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Payments — PaymentController response shapes ──────────────────────
export interface PaymentIntent {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  gateway: string;
  status: string;
  mockMode: boolean;
  demoSuccessOtp?: string;
}

export interface PaymentConfirmation {
  paymentId: string;
  status: string;
  gatewayPaymentId?: string;
  failureReason?: string;
}

export interface Payment {
  paymentId: string;
  status: string;
  amount: number;
  gateway: string;
  method?: string;
  createdAt: string;
}

// ─── Slot availability — SlotAvailabilityController ────────────────────
export interface SlotUsage {
  used: number;
  budget: number;
  available: number;
  full: boolean;
}

export interface DayAvailability {
  date: string;
  used: number;
  capacity: number;
  available: number;
  full: boolean;
  busyReason: string | null;
  slots: Record<TimeSlot, SlotUsage>;
}

export interface SlotAvailability {
  dayCapacity: number;
  slotBudgets: Record<TimeSlot, number>;
  days: DayAvailability[];
}

// ─── Pricing — PricingService#quote (Quote interface, backend-internal) ──
export interface PriceQuote {
  type: AcType;
  distanceKm: number;
  baseCharge: number;
  distanceCharge: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  couponCode?: string;
  discountPct?: number;
  couponMessage?: string;
}

// ─── Dashboard ──────────────────────────────────────────────────────────
export interface DashboardStats {
  activeProjects: number;
  openTickets: number;
  amcStatus?: string;
  nextAmcVisit?: NextAmcVisit;
  recentTickets: ServiceTicket[];
  properties: Property[];
}

// ─── Auth ───────────────────────────────────────────────────────────────
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user?: User;
}

// ─── Maps proxy (Places / Geocoding, Phase B5) ─────────────────────────
export interface AutocompleteSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
}

export interface AutocompleteResult {
  suggestions: AutocompleteSuggestion[];
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  pincode: string;
}

export interface TicketRoute {
  ticketNumber: string;
  originLat: number;
  originLng: number;
  originLabel: string;
  destLat?: number;
  destLng?: number;
  destAddress: string;
  distanceKm?: number;
  directionsUrl: string;
}

// ─── App meta / kill switch (Phase B... appMeta.routes.ts) ──────────────
export interface AppConfig {
  minSupportedVersion: string;
  latestVersion: string;
  updateRequired: boolean;
  updateAvailable: boolean;
  storeUrl: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  serverTime: string;
  features: {
    payments: boolean;
    amcUpgrades: boolean;
    errorCodeGuide: boolean;
  };
}

// ─── Uploads (Phase B4) ─────────────────────────────────────────────────
export interface UploadResult {
  urls: string[];
}

// ─── Devices / push tokens (Phase B3) ────────────────────────────────────
export interface DeviceRegistrationResult {
  registered: true;
}

// ─── Admin escalation dashboard — EscalationDashboardResponse (Phase 18) ──
export interface TeamWorkloadRow {
  userId: string;
  name: string;
  role: UserRole;
  level: number;
  activeCount: number;
  criticalCount: number;
  breachedCount: number;
  tickets: ServiceTicket[];
}

export interface EscalationDashboardResponse {
  escalatedNow: number;
  avgResponseMinutes: number;
  slaBreachToday: number;
  resolvedToday: number;
  l1Count: number;
  l2Count: number;
  l3Count: number;
  totalActive: number;
  criticalActive: number;
  l1Tickets: ServiceTicket[];
  l2Tickets: ServiceTicket[];
  l3Tickets: ServiceTicket[];
  teamWorkload: TeamWorkloadRow[];
  escalationLog: EscalationLog[];
}

// ─── Admin revenue dashboard — AdminRevenueService#dashboard (Phase 18) ───
export interface RevenueTransaction {
  ticketNumber: string;
  paidAt: string | null;
  amount: number | null;
  method: string | null;
  reference: string | null;
  customerName: string;
  customerPhone: string;
  priority: string;
  team: string | null;
}

export interface RevenueTeamRow {
  teamName: string;
  activeTickets: number;
  resolvedToday: number;
  revenueToday: number;
}

export interface RevenueEngineerRow {
  id: string;
  name: string;
  teamName: string;
  onShift: boolean;
  activeJobs: number;
}

export interface RevenueKpi {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  lifetime: number;
  paidCount: number;
  avgTicket: number;
  todayPctVsYesterday?: number;
  thisWeekPctVsLastWeek?: number;
  thisMonthPctVsLastMonth?: number;
  thisYearPctVsLastYear?: number;
}

export interface AdminRevenueDashboard {
  kpi: RevenueKpi;
  transactions: RevenueTransaction[];
  teams: RevenueTeamRow[];
  engineers: RevenueEngineerRow[];
  openTickets: number;
  criticalOpen: number;
  generatedAt: string;
}
