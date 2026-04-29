"use client"

import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  Eye,
  Loader2,
  Users,
  BedDouble,
  User,
  Wrench,
  Euro,
} from "lucide-react"
import { setRoomQuickState, type QuickRoomState } from "../_actions"

type RoomTypeAssignment = {
  id: string
  room_type_id: string
  priority: number
  is_active: boolean
  room_types: { id: string; name: string; short_code: string | null } | null
}

type Room = {
  id: string
  name: string
  floor: number | null
  status: string
  cleaning_status: string
  notes: string | null
  sort_order: number
  room_type_assignments: RoomTypeAssignment[]
}

type InHouseEntry = {
  room_id: string | null
  guest: { full_name: string } | null
  check_out: string
}

type Props = {
  rooms: Room[]
  inHouseMap: Record<string, InHouseEntry>
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string
    dot: string
    bg: string
    border: string
    text: string
    stripGradient: string
    iconBg: string
    iconColor: string
    Icon: React.ElementType
  }
> = {
  Available: {
    label: "Disponibile",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    stripGradient: "bg-gradient-to-r from-emerald-500 to-emerald-300",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    Icon: CheckCircle2,
  },
  Occupied: {
    label: "Occupata",
    dot: "bg-indigo-500",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    stripGradient: "bg-gradient-to-r from-indigo-500 to-violet-500",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-500",
    Icon: User,
  },
  Maintenance: {
    label: "Manutenzione",
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    stripGradient: "bg-gradient-to-r from-amber-500 to-amber-300",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    Icon: Wrench,
  },
  OutOfOrder: {
    label: "Fuori Servizio",
    dot: "bg-red-500",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    stripGradient: "bg-gradient-to-r from-red-500 to-red-300",
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    Icon: Wrench,
  },
}

const CLEANING_CONFIG: Record<
  string,
  {
    label: string
    icon: React.ElementType
    color: string
    bg: string
    border: string
    spin?: boolean
  }
> = {
  Clean: {
    label: "Pulita",
    icon: CheckCircle2,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  Dirty: {
    label: "Da pulire",
    icon: AlertTriangle,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  Inspection: {
    label: "Ispezione",
    icon: Eye,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  InProgress: {
    label: "In pulizia",
    icon: Loader2,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    spin: true,
  },
}

export function RoomsGrid({ rooms, inHouseMap }: Props) {
  if (rooms.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <BedDouble className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-slate-700 font-medium">Nessuna camera configurata</p>
        <p className="text-sm text-slate-500 mt-1">
          <Link href="/settings?tab=rooms" className="text-indigo-600 hover:underline">
            Vai alle impostazioni
          </Link>{" "}
          per aggiungerne
        </p>
      </div>
    )
  }

  // Group rooms by floor; fall back to numbered/named when floor missing
  const isNumbered = (name: string) => /^\d+$/.test(name.trim())

  const byFloor = new Map<string, Room[]>()
  const namedRooms: Room[] = []

  for (const room of rooms) {
    if (room.floor != null) {
      const key = String(room.floor)
      const arr = byFloor.get(key) ?? []
      arr.push(room)
      byFloor.set(key, arr)
    } else if (isNumbered(room.name)) {
      const key = "0"
      const arr = byFloor.get(key) ?? []
      arr.push(room)
      byFloor.set(key, arr)
    } else {
      namedRooms.push(room)
    }
  }

  const sortedFloors = Array.from(byFloor.entries()).sort(
    ([a], [b]) => Number(a) - Number(b)
  )

  const groups: Array<{ key: string; label: string; rooms: Room[] }> = []
  for (const [floor, arr] of sortedFloors) {
    const label = floor === "0" ? "Piano Terra" : `Piano ${floor}`
    groups.push({
      key: `floor-${floor}`,
      label,
      rooms: arr.sort((a, b) => a.sort_order - b.sort_order),
    })
  }
  if (namedRooms.length > 0) {
    groups.push({
      key: "named",
      label: "Suite & Appartamenti",
      rooms: namedRooms.sort((a, b) => a.sort_order - b.sort_order),
    })
  }

  return (
    <div className="space-y-8">
      {groups.map(({ key, label, rooms: groupRooms }) => (
        <div key={key}>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              {label}
            </p>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">
              {groupRooms.length} camere
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {groupRooms.map((room) => {
              const occupant = inHouseMap[room.id]
              const effectiveStatus = occupant ? "Occupied" : room.status
              const sc = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.Available
              const cc = CLEANING_CONFIG[room.cleaning_status] ?? CLEANING_CONFIG.Clean
              const CleanIcon = cc.icon
              const StatusIcon = sc.Icon
              const primaryType = room.room_type_assignments
                .slice()
                .sort((a, b) => a.priority - b.priority)[0]
              const typeLabel =
                primaryType?.room_types?.name ??
                primaryType?.room_types?.short_code ??
                ""

              return (
                <div key={room.id} className="group">
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                    <Link href={`/rooms/${room.id}`} className="block">
                    {/* Top color strip */}
                    <div className={`h-[6px] w-full ${sc.stripGradient}`} />

                    <div className="p-4">
                      {/* Header: number + status icon */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-4xl font-extrabold tracking-tight text-slate-900 leading-none">
                          {room.name}
                        </div>
                        <div
                          className={`w-8 h-8 rounded-lg ${sc.iconBg} flex items-center justify-center flex-shrink-0`}
                        >
                          <StatusIcon className={`h-4 w-4 ${sc.iconColor}`} />
                        </div>
                      </div>

                      {/* Room type */}
                      {typeLabel && (
                        <div className="text-[11px] text-slate-400 mb-2 truncate font-medium">
                          {typeLabel}
                        </div>
                      )}

                      {/* Cleaning badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cc.bg} ${cc.color} ${cc.border}`}
                      >
                        <CleanIcon
                          className={`h-3 w-3 ${cc.color} ${cc.spin ? "animate-spin" : ""}`}
                        />
                        {cc.label}
                      </span>

                      {/* Body */}
                      <div className="mt-3 min-h-[36px]">
                        {occupant?.guest ? (
                          <>
                            <div className="text-[11px] font-semibold text-slate-600 truncate">
                              {occupant.guest.full_name}
                            </div>
                            {occupant.check_out && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                →{" "}
                                {new Date(occupant.check_out).toLocaleDateString(
                                  "it-IT",
                                  { day: "2-digit", month: "2-digit" }
                                )}
                              </div>
                            )}
                          </>
                        ) : effectiveStatus === "Maintenance" ||
                          effectiveStatus === "OutOfOrder" ? (
                          <div className="text-[11px] text-slate-400">
                            {sc.label}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Users className="h-3 w-3" />
                            <span>Libera</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer: status + multi-type */}
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold ${sc.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                      {room.room_type_assignments.length > 1 ? (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          {room.room_type_assignments
                            .map((a) => a.room_types?.short_code ?? "")
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                          <Euro className="h-3 w-3" />
                          <span>—</span>
                        </span>
                      )}
                    </div>
                    </Link>
                    {/* Quick housekeeping actions */}
                    <QuickActions
                      roomId={room.id}
                      effectiveStatus={effectiveStatus}
                      cleaningStatus={room.cleaning_status}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function QuickActions({
  roomId,
  effectiveStatus,
  cleaningStatus,
}: {
  roomId: string
  effectiveStatus: string
  cleaningStatus: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function set(next: QuickRoomState | "Available") {
    startTransition(async () => {
      const res = await setRoomQuickState(roomId, next)
      if (!res.ok) {
        toast.error(res.error)
      } else {
        toast.success("Aggiornato")
        router.refresh()
      }
    })
  }

  const isMaintenance = effectiveStatus === "Maintenance" || effectiveStatus === "OutOfOrder"

  return (
    <div className="grid grid-cols-3 border-t border-slate-100 bg-white text-[10px] font-bold uppercase tracking-wider">
      <button
        type="button"
        disabled={isPending}
        onClick={() => set("Clean")}
        title="Segna come pulita"
        className={`flex items-center justify-center gap-1 py-2 transition-colors hover:bg-emerald-50 disabled:opacity-50 ${
          cleaningStatus === "Clean" && !isMaintenance
            ? "bg-emerald-50 text-emerald-700"
            : "text-slate-500"
        }`}
      >
        <CheckCircle2 className="h-3 w-3" />
        Pulita
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => set("Dirty")}
        title="Segna come da pulire"
        className={`flex items-center justify-center gap-1 border-x border-slate-100 py-2 transition-colors hover:bg-amber-50 disabled:opacity-50 ${
          cleaningStatus === "Dirty" && !isMaintenance
            ? "bg-amber-50 text-amber-700"
            : "text-slate-500"
        }`}
      >
        <AlertTriangle className="h-3 w-3" />
        Sporca
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => set(isMaintenance ? "Available" : "Maintenance")}
        title={isMaintenance ? "Esci dalla manutenzione" : "Imposta in manutenzione"}
        className={`flex items-center justify-center gap-1 py-2 transition-colors hover:bg-rose-50 disabled:opacity-50 ${
          isMaintenance ? "bg-rose-50 text-rose-700" : "text-slate-500"
        }`}
      >
        <Wrench className="h-3 w-3" />
        {isMaintenance ? "Riapri" : "Manut."}
      </button>
    </div>
  )
}
