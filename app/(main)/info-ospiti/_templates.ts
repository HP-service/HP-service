// Template pronti per pagine Info Ospiti — quando l'utente clicca crea una pagina pre-compilata.

export const TEMPLATES = [
  {
    title: "WiFi",
    icon: "wifi",
    content:
      "**Rete:** Nome-Rete-WiFi\n\n**Password:** la-tua-password\n\nLa rete è disponibile in tutta la struttura.",
  },
  {
    title: "Colazione",
    icon: "coffee",
    content:
      "**Orari:** 7:30 – 10:00\n\nServita in sala comune al piano terra. Buffet con prodotti tipici locali.\n\nIntolleranze? Comunicacele al check-in.",
  },
  {
    title: "Check-in / Check-out",
    icon: "key",
    content:
      "**Check-in:** dalle 15:00 alle 20:00\n\n**Check-out:** entro le 11:00\n\nPer arrivi tardivi contattaci al numero di emergenza.",
  },
  {
    title: "Come arrivare",
    icon: "map-pin",
    content:
      "**Indirizzo:** Via ..., Città\n\n**In auto:** ...\n\n**In treno:** stazione di ...\n\n**Parcheggio:** disponibile / non disponibile",
  },
  {
    title: "Contatti & Emergenze",
    icon: "phone",
    content:
      "**Reception:** +39 ...\n\n**Emergenze 24h:** +39 ...\n\n**Numeri utili:**\n- Polizia: 112\n- Ambulanza: 118\n- Farmacia di turno: ...",
  },
  {
    title: "Servizi extra",
    icon: "sparkles",
    content:
      "**Disponibili su richiesta:**\n\n- Transfer aeroporto\n- Noleggio bici\n- Lavanderia\n- Late check-out\n\nContattaci per prenotare.",
  },
  {
    title: "Cosa vedere in zona",
    icon: "compass",
    content:
      "Ecco i nostri suggerimenti:\n\n- Luogo 1 — descrizione\n- Luogo 2 — descrizione\n- Ristorante consigliato — ...",
  },
  {
    title: "Regolamento",
    icon: "shield-check",
    content:
      "**Silenzio:** dalle 22:00 alle 7:00\n\n**Animali:** ammessi / non ammessi\n\n**Fumare:** vietato all'interno\n\nGrazie per il rispetto.",
  },
] as const
