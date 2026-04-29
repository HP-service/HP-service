export const dynamic = "force-dynamic"

import Link from "next/link"
import { getRoomTypes, getRooms, getChannels, getStaff, getProperty } from "@db/queries/settings"
import { RoomTypesManager } from "./_components/room-types-manager"
import { RoomsManager } from "./_components/rooms-manager"
import { ChannelsManager } from "./_components/channels-manager"
import { StaffManager } from "./_components/staff-manager"
import { PropertySettings } from "./_components/property-settings"
import { AlloggiatiSettings } from "./_components/alloggiati-settings"
import { IstatSettings } from "./_components/istat-settings"
import { PortalSettings } from "./_components/portal-settings"
import { IcalSettings } from "./_components/ical-settings"
import { TouristTaxSettings } from "./_components/tourist-tax-settings"
import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { getPortalServices, getPortalAttractions } from "@db/queries/portal-admin"
import { getIcalToken, getIcalSubscriptions, getRoomsForIcal, getChannelsForIcal } from "@db/queries/ical"
import {
  Building2, BedDouble, Radio, Users, Globe, FileBarChart, Monitor, Link2, Coins, LayoutGrid,
} from "lucide-react"
import { cn } from "@utils/cn"

const NAV_GROUPS = [
  {
    label: "Base",
    color: "text-blue-600",
    items: [
      { id: "property", label: "Struttura", icon: Building2, description: "Nome, indirizzo, contatti" },
      { id: "room-types", label: "Tipologie Camera", icon: LayoutGrid, description: "Tipi e prezzi base" },
      { id: "rooms", label: "Camere", icon: BedDouble, description: "Camere fisiche" },
    ],
  },
  {
    label: "Canali",
    color: "text-purple-600",
    items: [
      { id: "channels", label: "Canali OTA", icon: Radio, description: "Commissioni e canali" },
      { id: "ical", label: "Sync iCal", icon: Link2, description: "Booking.com, Airbnb..." },
      { id: "portal", label: "Portale Ospiti", icon: Monitor, description: "Portale e chatbot AI" },
    ],
  },
  {
    label: "Admin",
    color: "text-amber-600",
    items: [
      { id: "staff", label: "Personale", icon: Users, description: "Staff e ruoli" },
    ],
  },
  {
    label: "Compliance",
    color: "text-emerald-600",
    items: [
      { id: "alloggiati", label: "Alloggiati Web", icon: Globe, description: "Invio alla Questura" },
      { id: "istat", label: "ISTAT", icon: FileBarChart, description: "Statistiche regionali" },
      { id: "tassa-soggiorno", label: "Tassa Soggiorno", icon: Coins, description: "Aliquote comunali" },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const profile = await requireRole(MAIN_APP_ROLES)
  const propertyId = profile.property_id!
  const { tab } = await searchParams
  const activeTab = tab ?? "property"

  const activeItem = ALL_ITEMS.find((i) => i.id === activeTab) ?? ALL_ITEMS[0]

  const [roomTypesResult, roomsResult, channelsResult, staffResult, propertyResult, servicesResult, attractionsResult, icalTokenResult, icalSubsResult, icalRoomsResult, icalChannelsResult] = await Promise.all([
    getRoomTypes(),
    getRooms(),
    getChannels(),
    getStaff(),
    getProperty(),
    getPortalServices(propertyId),
    getPortalAttractions(propertyId),
    getIcalToken(),
    getIcalSubscriptions(),
    getRoomsForIcal(),
    getChannelsForIcal(),
  ])

  function renderContent() {
    switch (activeTab) {
      case "room-types":
        return roomTypesResult.error ? (
          <p className="text-sm text-destructive">{roomTypesResult.error}</p>
        ) : (
          <RoomTypesManager propertyId={propertyId} roomTypes={roomTypesResult.data ?? []} />
        )

      case "rooms":
        return roomsResult.error ? (
          <p className="text-sm text-destructive">{roomsResult.error}</p>
        ) : (
          <RoomsManager
            propertyId={propertyId}
            rooms={(roomsResult.data ?? []) as Parameters<typeof RoomsManager>[0]["rooms"]}
            roomTypes={roomTypesResult.data ?? []}
          />
        )

      case "channels":
        return channelsResult.error ? (
          <p className="text-sm text-destructive">{channelsResult.error}</p>
        ) : (
          <ChannelsManager propertyId={propertyId} channels={channelsResult.data ?? []} />
        )

      case "staff":
        return staffResult.error ? (
          <p className="text-sm text-destructive">{staffResult.error}</p>
        ) : (
          <StaffManager propertyId={propertyId} staff={staffResult.data ?? []} />
        )

      case "property":
        return propertyResult.error ? (
          <p className="text-sm text-destructive">{propertyResult.error}</p>
        ) : !propertyResult.data ? (
          <p className="text-sm text-muted-foreground">Struttura non trovata</p>
        ) : (
          <PropertySettings property={propertyResult.data} />
        )

      case "alloggiati":
        return propertyResult.error ? (
          <p className="text-sm text-destructive">{propertyResult.error}</p>
        ) : !propertyResult.data ? (
          <p className="text-sm text-muted-foreground">Struttura non trovata</p>
        ) : (
          <AlloggiatiSettings
            propertyId={propertyResult.data.id}
            currentSettings={(propertyResult.data.settings || {}) as {
              alloggiati_username?: string
              alloggiati_password?: string
              alloggiati_wskey?: string
            }}
          />
        )

      case "istat":
        return propertyResult.error ? (
          <p className="text-sm text-destructive">{propertyResult.error}</p>
        ) : !propertyResult.data ? (
          <p className="text-sm text-muted-foreground">Struttura non trovata</p>
        ) : (
          <IstatSettings
            propertyId={propertyResult.data.id}
            currentSettings={(propertyResult.data.settings || {}) as {
              istat_cusr?: string
              istat_apikey?: string
              istat_sandbox?: boolean
            }}
          />
        )

      case "portal":
        return propertyResult.error ? (
          <p className="text-sm text-destructive">{propertyResult.error}</p>
        ) : !propertyResult.data ? (
          <p className="text-sm text-muted-foreground">Struttura non trovata</p>
        ) : (
          <PortalSettings
            propertyId={propertyResult.data.id}
            currentSettings={(propertyResult.data.settings || {}) as {
              portal_enabled?: boolean
              portal_whatsapp_number?: string
              portal_welcome_message?: string
              portal_wifi_network?: string
              portal_wifi_password?: string
              portal_hotel_info?: string
              ai_enabled?: boolean
              ai_provider?: string
              ai_api_key?: string
              ai_model?: string
              ai_schedule_start?: string
              ai_schedule_end?: string
              ai_knowledge_base?: string
              ai_personality?: string
            }}
            initialServices={(servicesResult.data ?? []) as Parameters<typeof PortalSettings>[0]["initialServices"]}
            initialAttractions={(attractionsResult.data ?? []) as Parameters<typeof PortalSettings>[0]["initialAttractions"]}
          />
        )

      case "tassa-soggiorno":
        return propertyResult.error ? (
          <p className="text-sm text-destructive">{propertyResult.error}</p>
        ) : !propertyResult.data ? (
          <p className="text-sm text-muted-foreground">Struttura non trovata</p>
        ) : (
          <TouristTaxSettings
            propertyId={propertyResult.data.id}
            channels={(channelsResult.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
            currentSettings={(propertyResult.data.settings || {}) as {
              tourist_tax_enabled?: boolean
              tourist_tax_rate?: number
              tourist_tax_max_nights?: number
              tourist_tax_child_exempt_age?: number
              tourist_tax_exempt_residents?: boolean
              tourist_tax_exempt_ota_channels?: string[]
              tourist_tax_municipality?: string
              tourist_tax_catastale_code?: string
            }}
          />
        )

      case "ical":
        return (
          <IcalSettings
            propertyId={propertyId}
            rooms={(icalRoomsResult.data ?? []) as { id: string; name: string }[]}
            channels={(icalChannelsResult.data ?? []) as { id: string; name: string }[]}
            subscriptions={(icalSubsResult.data ?? []) as Parameters<typeof IcalSettings>[0]["subscriptions"]}
            icalToken={icalTokenResult.data ?? ""}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-foreground">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">Configurazione struttura, camere, canali e personale</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar navigation */}
        <aside className="w-56 flex-shrink-0 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2 mb-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${group.color}`}>
                  {group.label}
                </span>
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.id === activeTab
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.id}
                      href={`/settings?tab=${item.id}`}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 group relative",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary" />
                      )}
                      <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      <span className={cn("text-sm", isActive ? "font-semibold text-sidebar-accent-foreground" : "font-medium")}>
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground">{activeItem.label}</h2>
              <p className="text-sm text-muted-foreground">{activeItem.description}</p>
            </div>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
