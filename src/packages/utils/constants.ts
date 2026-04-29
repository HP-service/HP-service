export const APP_NAME = "Gestionale Hotel"
export const DEFAULT_CURRENCY = "EUR"
export const DEFAULT_TIMEZONE = "Europe/Rome"
export const DEFAULT_CHECK_IN_TIME = "15:00"
export const DEFAULT_CHECK_OUT_TIME = "11:00"
export const DEFAULT_LOCALE = "it-IT"

export const BOOKING_STATUSES = [
  "Inquiry",
  "Confirmed",
  "CheckedIn",
  "CheckedOut",
  "Cancelled",
  "NoShow",
] as const

export const USER_ROLES = [
  "Manager",
  "Reception",
  "Housekeeping",
  "Maintenance",
] as const

export const ROOM_STATUSES = [
  "Available",
  "Occupied",
  "Maintenance",
  "OutOfOrder",
] as const

export const CLEANING_STATUSES = [
  "Clean",
  "Dirty",
  "Inspection",
  "InProgress",
] as const

export const TASK_TYPES = [
  "CleaningCheckout",
  "CleaningStayover",
  "CleaningDeep",
  "Maintenance",
  "Inspection",
] as const

export const TASK_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const

export const PAYMENT_METHODS = [
  "Cash",
  "CreditCard",
  "BankTransfer",
  "OTAVirtualCard",
  "Satispay",
  "Other",
] as const
