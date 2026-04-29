import { z } from "zod"

// NOTE: All schemas avoid z.coerce and .default() so that z.infer<> produces
// concrete types (no `unknown`, no `T | undefined`) compatible with zodResolver.
// Default values are set via useForm's `defaultValues` instead.

// ============================================
// Property
// ============================================

export const propertySchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string(),
  phone: z.string().optional(),
  email: z.string().email("Email non valida").optional(),
  vat_number: z.string().optional(),
  fiscal_code: z.string().optional(),
  check_in_time: z.string(),
  check_out_time: z.string(),
  currency: z.string(),
  timezone: z.string(),
})

// ============================================
// Room Type
// ============================================

export const roomTypeSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  description: z.string().optional(),
  short_code: z.string().max(5).optional(),
  default_capacity: z.number().int().min(1),
  max_capacity: z.number().int().min(1),
  base_price: z.number().min(0, "Prezzo non valido"),
  amenities: z.array(z.string()),
  sort_order: z.number().int(),
  is_active: z.boolean(),
})

// ============================================
// Room
// ============================================

export const roomSchema = z.object({
  name: z.string().min(1, "Nome camera obbligatorio"),
  floor: z.number().int().optional(),
  status: z.enum(["Available", "Occupied", "Maintenance", "OutOfOrder"]),
  cleaning_status: z.enum(["Clean", "Dirty", "Inspection", "InProgress"]),
  notes: z.string().optional(),
  features: z.array(z.string()),
  sort_order: z.number().int(),
})

// ============================================
// Room Type Assignment
// ============================================

export const roomTypeAssignmentSchema = z.object({
  room_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  priority: z.number().int().min(1),
  is_active: z.boolean(),
})

// ============================================
// Guest
// ============================================

export const guestSchema = z.object({
  full_name: z.string().min(1, "Nome obbligatorio"),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  phone: z.string().optional(),
  nationality: z.string().optional(),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  document_expiry: z.string().optional(),
  date_of_birth: z.string().optional(),
  tax_code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()),
})

// ============================================
// Booking
// ============================================

// bookingBaseSchema exported separately so z.infer<> works correctly with zodResolver.
// (.refine() wraps in ZodEffects and can confuse the Resolver generic in strict mode)
export const bookingBaseSchema = z.object({
  guest_id: z.string().uuid("Seleziona un ospite"),
  room_type_id: z.string().uuid("Seleziona un tipo camera"),
  room_id: z.string().uuid().optional().nullable(),
  channel_id: z.string().uuid().optional().nullable(),
  check_in: z.string().min(1, "Data check-in obbligatoria"),
  check_out: z.string().min(1, "Data check-out obbligatoria"),
  adults: z.number().int().min(1),
  children: z.number().int().min(0),
  total_amount: z.number().min(0).optional(),
  has_early_check_in: z.boolean(),
  has_late_check_out: z.boolean(),
  special_requests: z.string().optional(),
  internal_notes: z.string().optional(),
  external_ref: z.string().optional(),
})

export const bookingSchema = bookingBaseSchema.refine(
  (data) => new Date(data.check_out) > new Date(data.check_in),
  { message: "La data di check-out deve essere dopo il check-in", path: ["check_out"] }
)

// ============================================
// Booking Status Change
// ============================================

export const bookingStatusChangeSchema = z.object({
  status: z.enum(["Inquiry", "Confirmed", "CheckedIn", "CheckedOut", "Cancelled", "NoShow"]),
  room_id: z.string().uuid().optional(),
  cancellation_reason: z.string().optional(),
})

// ============================================
// Invoice Item
// ============================================

export const invoiceItemSchema = z.object({
  folio_id: z.string().uuid(),
  description: z.string().min(1, "Descrizione obbligatoria"),
  category: z.string(),
  quantity: z.number().min(0.01),
  unit_price: z.number(),
  tax_rate: z.number().min(0).max(1),
  date: z.string().optional(),
})

// ============================================
// Transaction
// ============================================

export const transactionSchema = z.object({
  folio_id: z.string().uuid(),
  amount: z.number().min(0.01, "Importo non valido"),
  method: z.enum(["Cash", "CreditCard", "BankTransfer", "OTAVirtualCard", "Satispay", "Other"]),
  type: z.enum(["Deposit", "Settlement", "Refund", "Adjustment"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

// ============================================
// Expense
// ============================================

export const expenseSchema = z.object({
  category_id: z.string().uuid("Seleziona una categoria"),
  description: z.string().min(1, "Descrizione obbligatoria"),
  amount: z.number().min(0.01, "Importo non valido"),
  tax_amount: z.number().min(0),
  date: z.string().min(1, "Data obbligatoria"),
  vendor: z.string().optional(),
  room_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
})

// ============================================
// Task
// ============================================

export const taskSchema = z.object({
  room_id: z.string().uuid().optional().nullable(),
  booking_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  type: z.enum(["CleaningCheckout", "CleaningStayover", "CleaningDeep", "Maintenance", "Inspection"]),
  priority: z.enum(["Low", "Normal", "High", "Urgent"]),
  title: z.string().min(1, "Titolo obbligatorio"),
  description: z.string().optional(),
  estimated_minutes: z.number().int().min(1),
  due_date: z.string().optional(),
})

// ============================================
// Booking Channel
// ============================================

export const bookingChannelSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  commission_rate: z.number().min(0).max(100),
  is_active: z.boolean(),
})

// ============================================
// Expense Category
// ============================================

export const expenseCategorySchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  parent_id: z.string().uuid().optional().nullable(),
  color: z.string().optional(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
})

// ============================================
// Competitor Structure
// ============================================

export const competitorStructureSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  url: z.string().url("URL non valido").optional().or(z.literal("")),
  platform: z.string().optional(),
  location: z.string().optional(),
  stars: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
})

// ============================================
// Staff (for creating users via admin)
// ============================================

export const staffSchema = z.object({
  full_name: z.string().min(1, "Nome obbligatorio"),
  email: z.string().email("Email non valida"),
  role: z.enum(["Manager", "Reception", "Housekeeping", "Maintenance"]),
  password: z.string().min(6, "Minimo 6 caratteri"),
})

// ============================================
// Check-in (Alloggiati Web)
// ============================================

/** Schema ospite principale per check-in (tipo 16/17/18 - con documento) */
export const checkInPrimarySchema = z.object({
  cognome: z.string().min(1, "Cognome obbligatorio").max(50),
  nome: z.string().min(1, "Nome obbligatorio").max(30),
  sesso: z.enum(["1", "2"], { message: "Sesso obbligatorio" }),
  data_nascita: z.string().min(1, "Data di nascita obbligatoria"),
  stato_nascita: z.string().min(1, "Stato di nascita obbligatorio"),
  comune_nascita: z.string().optional(),
  provincia_nascita: z.string().optional(),
  cittadinanza: z.string().min(1, "Cittadinanza obbligatoria"),
  tipo_documento: z.string().min(1, "Tipo documento obbligatorio"),
  numero_documento: z.string().min(1, "Numero documento obbligatorio").max(20),
  luogo_rilascio: z.string().min(1, "Luogo rilascio obbligatorio"),
})

/** Schema accompagnatore per check-in (tipo 19/20 - senza documento) */
export const checkInAccompagnatoreSchema = z.object({
  cognome: z.string().min(1, "Cognome obbligatorio").max(50),
  nome: z.string().min(1, "Nome obbligatorio").max(30),
  sesso: z.enum(["1", "2"], { message: "Sesso obbligatorio" }),
  data_nascita: z.string().min(1, "Data di nascita obbligatoria"),
  stato_nascita: z.string().min(1, "Stato di nascita obbligatorio"),
  comune_nascita: z.string().optional(),
  provincia_nascita: z.string().optional(),
  cittadinanza: z.string().min(1, "Cittadinanza obbligatoria"),
})

/** Schema form check-in completo */
export const checkInFormSchema = z.object({
  primary: checkInPrimarySchema,
  guest_type: z.enum(["16", "17", "18"]),
  accompagnatori: z.array(
    checkInAccompagnatoreSchema.extend({
      guest_id: z.string().uuid().optional(),
      guest_type: z.enum(["19", "20"]),
    })
  ),
})

/** Schema credenziali Alloggiati Web (salvate in properties.settings) */
export const alloggiatiSettingsSchema = z.object({
  alloggiati_username: z.string().min(1, "Username obbligatorio"),
  alloggiati_password: z.string().min(1, "Password obbligatoria"),
  alloggiati_wskey: z.string().min(1, "WSKey obbligatoria"),
})

// ============================================
// Portal Service
// ============================================

export const portalServiceSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  description: z.string().optional(),
  category: z.string().min(1, "Categoria obbligatoria"),
  price: z.number().min(0).optional().nullable(),
  image_url: z.string().optional(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
})

// ============================================
// Portal Attraction
// ============================================

export const portalAttractionSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  description: z.string().optional(),
  category: z.string().min(1, "Categoria obbligatoria"),
  image_url: z.string().optional(),
  external_url: z.string().optional(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
})

// ============================================
// Portal Settings (saved in properties.settings JSONB)
// ============================================

export const portalSettingsSchema = z.object({
  portal_enabled: z.boolean(),
  portal_whatsapp_number: z.string().optional(),
  portal_welcome_message: z.string().optional(),
  portal_wifi_network: z.string().optional(),
  portal_wifi_password: z.string().optional(),
  portal_hotel_info: z.string().optional(),
})

// ============================================
// AI Concierge Settings (saved in properties.settings JSONB)
// ============================================

export const aiConciergeSettingsSchema = z.object({
  ai_enabled: z.boolean(),
  ai_provider: z.enum(["openai", "anthropic", "google"]),
  ai_api_key: z.string().optional(),
  ai_model: z.string().optional(),
  ai_schedule_start: z.string(),
  ai_schedule_end: z.string(),
  ai_knowledge_base: z.string().optional(),
  ai_personality: z.string().optional(),
})

// ============================================
// Tourist Tax (Tassa di Soggiorno)
// ============================================

export const touristTaxSettingsSchema = z.object({
  tourist_tax_enabled: z.boolean(),
  tourist_tax_rate: z.number().min(0).max(50),
  tourist_tax_max_nights: z.number().int().min(1).max(365),
  tourist_tax_child_exempt_age: z.number().int().min(0).max(18),
  tourist_tax_exempt_residents: z.boolean(),
  tourist_tax_exempt_ota_channels: z.array(z.string()),
  tourist_tax_municipality: z.string().optional(),
  tourist_tax_catastale_code: z.string().max(4).optional(),
})
