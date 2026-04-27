import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const dealStage = pgEnum("deal_stage", [
  "new",
  "qualifying",
  "qualified",
  "negotiating",
  "contract_draft",
  "contract_sent",
  "contract_signed",
  "in_production",
  "deliverables_submitted",
  "invoiced",
  "paid",
  "completed",
  "declined",
  "lost",
]);

export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"]);
export const messageChannel = pgEnum("message_channel", ["email", "form", "manual_note"]);
export const messageStatus = pgEnum("message_status", [
  "pending",
  "queued",
  "scheduled",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "received",
]);
export const documentKind = pgEnum("document_kind", [
  "contract_draft",
  "contract_final",
  "brief",
  "attachment",
  "invoice",
  "other",
]);
export const documentStatus = pgEnum("document_status", [
  "draft",
  "pending_review",
  "approved",
  "sent",
  "signed",
  "declined",
]);
export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "overdue",
  "void",
  "uncollectible",
]);
export const taskKind = pgEnum("task_kind", [
  "follow_up",
  "chase_brief",
  "reminder",
  "internal_note",
  "custom",
]);
export const taskStatus = pgEnum("task_status", ["open", "completed", "cancelled"]);
export const agentRunStatus = pgEnum("agent_run_status", [
  "running",
  "success",
  "failed",
  "escalated",
]);
export const escalationReason = pgEnum("escalation_reason", [
  "low_confidence",
  "non_standard_contract_clause",
  "pricing_exception",
  "policy_violation",
  "brand_asked_if_bot",
  "threatening_language",
  "overdue_high_value",
  "tool_failure",
  "other",
]);
export const escalationStatus = pgEnum("escalation_status", [
  "open",
  "in_review",
  "resolved",
  "dismissed",
]);

const now = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const pregateSubmissions = pgTable("pregate_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  handleTiktok: text("handle_tiktok"),
  handleInstagram: text("handle_instagram"),
  handleYoutube: text("handle_youtube"),
  handleTwitter: text("handle_twitter"),
  handlePinterest: text("handle_pinterest"),
  handleSnapchat: text("handle_snapchat"),
  referralCode: text("referral_code"),
  selectedTier: text("selected_tier"),
  convertedToClient: boolean("converted_to_client").notNull().default(false),
  resultingClientId: uuid("resulting_client_id"),
  source: text("source").default("cruise_qr"),
  ipAddress: text("ip_address"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  termsVersion: text("terms_version").default("v1.0"),
  createdAt: now(),
});

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  creatorDisplayName: text("creator_display_name").notNull(),
  handleInstagram: text("handle_instagram"),
  handleTiktok: text("handle_tiktok"),
  handleYoutube: text("handle_youtube"),
  handleTwitter: text("handle_twitter"),
  niche: text("niche"),
  followerCountRange: text("follower_count_range"),
  timezone: text("timezone").notNull().default("America/New_York"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionTier: text("subscription_tier"),
  subscriptionStatus: text("subscription_status").default("inactive"),
  status: text("status").notNull().default("onboarding"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  wizardStep: integer("wizard_step").notNull().default(1),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: now(),
  updatedAt: updatedAt(),
});

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  role: text("role").notNull(),
  affiliateTier: text("affiliate_tier").notNull().default("standard"),
  referralCode: text("referral_code").unique(),
  referredByUserId: uuid("referred_by_user_id"),
  createdAt: now(),
});

export const userClients = pgTable(
  "user_clients",
  {
    userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    accessLevel: text("access_level").notNull(),
    createdAt: now(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.clientId] })],
);

export const affiliateCommissions = pgTable("affiliate_commissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  affiliateUserId: uuid("affiliate_user_id").notNull().references(() => userProfiles.id),
  referredClientId: uuid("referred_client_id").notNull().references(() => clients.id),
  commissionTier: integer("commission_tier").notNull(),
  commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }).notNull(),
  monthYear: text("month_year").notNull(),
  baseAmountCents: bigint("base_amount_cents", { mode: "number" }).notNull(),
  commissionCents: bigint("commission_cents", { mode: "number" }).notNull(),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: now(),
});

export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  title: text("title").notNull(),
  sendingEmail: text("sending_email").notNull().unique(),
  sendingName: text("sending_name").notNull(),
  signatureHtml: text("signature_html").notNull(),
  voiceProfileJson: jsonb("voice_profile_json").notNull().default(sql`'{}'::jsonb`),
  workingHoursJson: jsonb("working_hours_json")
    .notNull()
    .default(sql`'{"timezone":"America/New_York","mon_fri_start":"09:00","mon_fri_end":"18:00","weekend":false}'::jsonb`),
  active: boolean("active").notNull().default(true),
  createdAt: now(),
});

export const clientPersonas = pgTable(
  "client_personas",
  {
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    personaId: uuid("persona_id").notNull().references(() => personas.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: now(),
  },
  (table) => [
    primaryKey({ columns: [table.clientId, table.personaId] }),
    uniqueIndex("one_primary_persona_per_client").on(table.clientId).where(sql`${table.isPrimary} = true`),
  ],
);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  website: text("website"),
  industry: text("industry"),
  notes: text("notes"),
  createdAt: now(),
  updatedAt: updatedAt(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    fullName: text("full_name"),
    title: text("title"),
    phone: text("phone"),
    source: text("source"),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (table) => [index("idx_contacts_client_email").on(table.clientId, table.email)],
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    primaryContactId: uuid("primary_contact_id").references(() => contacts.id, { onDelete: "set null" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    assignedPersonaId: uuid("assigned_persona_id").references(() => personas.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    stage: dealStage("stage").notNull().default("new"),
    campaignType: text("campaign_type"),
    platforms: text("platforms").array(),
    quotedAmountCents: bigint("quoted_amount_cents", { mode: "number" }),
    currency: text("currency").notNull().default("USD"),
    usageRightsRequested: jsonb("usage_rights_requested"),
    deliverables: jsonb("deliverables"),
    dueDate: date("due_date"),
    nextActionDueAt: timestamp("next_action_due_at", { withTimezone: true }),
    qualificationScore: numeric("qualification_score", { precision: 3, scale: 2 }),
    qualificationReason: text("qualification_reason"),
    declineReason: text("decline_reason"),
    escalated: boolean("escalated").notNull().default(false),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_deals_client_stage").on(table.clientId, table.stage),
    index("idx_deals_next_action").on(table.nextActionDueAt).where(sql`${table.nextActionDueAt} is not null`),
  ],
);

export const dealStageHistory = pgTable("deal_stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  fromStage: dealStage("from_stage"),
  toStage: dealStage("to_stage").notNull(),
  changedByAgent: text("changed_by_agent"),
  changedByUserId: uuid("changed_by_user_id").references(() => userProfiles.id),
  reason: text("reason"),
  createdAt: now(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    personaId: uuid("persona_id").references(() => personas.id, { onDelete: "set null" }),
    direction: messageDirection("direction").notNull(),
    channel: messageChannel("channel").notNull(),
    status: messageStatus("status").notNull().default("pending"),
    threadId: text("thread_id"),
    inReplyTo: text("in_reply_to"),
    subject: text("subject"),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    fromAddress: text("from_address"),
    toAddresses: text("to_addresses").array(),
    ccAddresses: text("cc_addresses").array(),
    rawPayload: jsonb("raw_payload"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    scheduledSendAt: timestamp("scheduled_send_at", { withTimezone: true }),
    draftedByAgent: text("drafted_by_agent"),
    draftConfidence: numeric("draft_confidence", { precision: 3, scale: 2 }),
    requiresReview: boolean("requires_review").notNull().default(false),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => userProfiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: now(),
  },
  (table) => [
    index("idx_messages_deal").on(table.dealId, table.createdAt),
    index("idx_messages_thread").on(table.threadId).where(sql`${table.threadId} is not null`),
    index("idx_messages_scheduled").on(table.scheduledSendAt).where(sql`${table.status} = 'queued'`),
  ],
);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
  kind: documentKind("kind").notNull(),
  status: documentStatus("status").notNull().default("draft"),
  title: text("title").notNull(),
  storagePath: text("storage_path"),
  contentText: text("content_text"),
  contentHtml: text("content_html"),
  documensoDocumentId: text("documenso_document_id"),
  signingUrl: text("signing_url"),
  createdByAgent: text("created_by_agent"),
  nonStandardClauses: jsonb("non_standard_clauses"),
  requiresReview: boolean("requires_review").notNull().default(false),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => userProfiles.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  createdAt: now(),
  updatedAt: updatedAt(),
});

export const contractTemplates = pgTable("contract_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  campaignType: text("campaign_type"),
  templateText: text("template_text").notNull(),
  requiredVariables: text("required_variables").array().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: now(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "restrict" }),
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  invoiceNumber: text("invoice_number"),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("USD"),
  status: invoiceStatus("status").notNull().default("draft"),
  dueDate: date("due_date").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  lineItems: jsonb("line_items").notNull(),
  hostedInvoiceUrl: text("hosted_invoice_url"),
  pdfUrl: text("pdf_url"),
  reminderCount: integer("reminder_count").notNull().default(0),
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
  createdAt: now(),
  updatedAt: updatedAt(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    kind: taskKind("kind").notNull(),
    status: taskStatus("status").notNull().default("open"),
    title: text("title").notNull(),
    body: text("body"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByAgent: text("created_by_agent"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => userProfiles.id),
    createdAt: now(),
  },
  (table) => [index("idx_tasks_due").on(table.dueAt).where(sql`${table.status} = 'open'`)],
);

export const clientPolicies = pgTable("client_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().unique().references(() => clients.id, { onDelete: "cascade" }),
  policyJson: jsonb("policy_json").notNull(),
  version: integer("version").notNull().default(1),
  updatedByUserId: uuid("updated_by_user_id").references(() => userProfiles.id),
  updatedAt: updatedAt(),
});

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    agentName: text("agent_name").notNull(),
    triggerEvent: text("trigger_event").notNull(),
    inputRef: jsonb("input_ref"),
    status: agentRunStatus("status").notNull().default("running"),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    outputJson: jsonb("output_json"),
    errorText: text("error_text"),
    langfuseTraceId: text("langfuse_trace_id"),
    llmTokensInput: integer("llm_tokens_input"),
    llmTokensOutput: integer("llm_tokens_output"),
    llmCostCents: numeric("llm_cost_cents", { precision: 10, scale: 4 }),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [index("idx_agent_runs_client").on(table.clientId, table.startedAt)],
);

export const escalations = pgTable(
  "escalations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    reason: escalationReason("reason").notNull(),
    severity: text("severity").notNull(),
    summary: text("summary").notNull(),
    contextJson: jsonb("context_json"),
    suggestedAction: text("suggested_action"),
    status: escalationStatus("status").notNull().default("open"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => userProfiles.id),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: now(),
  },
  (table) => [index("idx_escalations_open").on(table.clientId, table.severity).where(sql`${table.status} = 'open'`)],
);

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html"),
    variables: text("variables").array().notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("email_templates_client_key_unique").on(table.clientId, table.key)],
);

export const intakeSubmissions = pgTable("intake_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url"),
  submittedPayload: jsonb("submitted_payload").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  processed: boolean("processed").notNull().default(false),
  resultingDealId: uuid("resulting_deal_id").references(() => deals.id),
  createdAt: now(),
});

export const activityFeed = pgTable(
  "activity_feed",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    actor: text("actor").notNull(),
    metadata: jsonb("metadata"),
    createdAt: now(),
  },
  (table) => [index("idx_activity_feed_client").on(table.clientId, table.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    diffJson: jsonb("diff_json"),
    createdAt: now(),
  },
  (table) => [index("idx_audit_entity").on(table.entityType, table.entityId)],
);
