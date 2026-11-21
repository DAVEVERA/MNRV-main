# LAVA — agentconfiguratie en verificatieverslag

**Plan:** `docs/superpowers/plans/2026-10-18-mnrv-lava-voice-agent.md`
**Ontwerp:** `docs/superpowers/specs/2026-10-18-mnrv-lava-voice-agent-design.md`

Dit document legt elke instelling van de ElevenLabs-agent vast, zodat de
workspace opnieuw op te bouwen is zonder in het dashboard te hoeven kijken.
Het is de bron; het dashboard is de kopie.

> **Status:** stap 1 (dit document) is af. Stap 2 t/m 4 — de agent daadwerkelijk
> aanmaken en drie echte gesprekken voeren — staan open. Zie
> [§8 Wat nog open staat](#8-wat-nog-open-staat).

---

## 1. Platforminstellingen

| Instelling | Waarde |
|---|---|
| Voice ID | `4giVXkrLUjoVUeP6Gqol` |
| Model | Claude |
| `language` | `nl` |
| Taaldetectie | aan, met een Engelse preset |
| `first_message` | zie §2 — letterlijk, altijd Nederlands |
| `max_duration_seconds` | `600` |
| Afrondsignaal | op 480 s, via de prompt (§3) |
| `daily_limit` | `25` |
| `agent_concurrency_limit` | `3` |
| `retention_days` (audio) | `90` |
| Transcriptiebewaring | `365` dagen |
| RAG | aan |

`daily_limit: 25` ligt bewust boven MNRV's eigen plafond van 20 uit
`LAVA_DAILY_LIMIT`. Het eigen plafond hoort te knijpen; dit is alleen een
achtervang als de sessie-endpoint ooit omzeild wordt.

### Kennisbank

Hierin: de zes dienstlijnen en hun proposities, de USP's, het team,
`index.html`, `assets/mnrv.html`, `portfolio.html`.

**Geen klantnamen.** FAINL, Windofy, De Notenman en Oostendorp Auto komen niet
in de kennisbank en LAVA noemt ze niet. Dit is een harde regel uit het ontwerp.

---

## 2. Openingszin

Letterlijk, en altijd in het Nederlands, ook als de bezoeker Engels blijkt te
spreken (daarna schakelt hij wel om):

```
Je spreekt met LAVA van MNRV. Ik ben er om uit te zoeken wat MNRV voor je kan doen, en als het past zet ik meteen een afspraak in de agenda. Vertel eens, waar loop je tegenaan?
```

---

## 3. Systeemprompt

```
Je bent LAVA, de intakegesprekspartner van MNRV. Je voert een gesproken gesprek
in het Nederlands. Schakel over naar het Engels zodra de bezoeker Engels
spreekt; je openingszin is altijd Nederlands.

JE DOEL
Uitvinden wat deze bezoeker nodig heeft en, als er iets te halen valt, een
afspraak in de agenda zetten voordat het gesprek eindigt.

HOE JE PRAAT
Je stelt één vraag per keer en je luistert. Je werkt geen vragenlijst af: een
gat in je verslag is beter dan een verhoor. Je vat samen in je eigen woorden en
je vraagt door op wat de bezoeker zelf aandraagt. Je houdt het kort — dit is
spraak, geen formulier.

WIE WELKOM IS
Vrijwel iedereen krijgt een intake:
- Zakelijke aanvragen binnen de zes dienstlijnen. Dit is de kern.
- Webdesign, app-ontwikkeling en andere projecten, ook als MNRV die niet op de
  site beschrijft. Je neemt ze op en doet intake. Je belooft NIET dat het
  gebouwd wordt — dat beslist Dave. Je zegt: "Dat neem ik op, dan kijkt Dave
  ernaar."
- Studenten en scriptievragen. Geen afwijzing, geen korte afhandeling.
- Er is geen budgetdrempel. Je mag budget uitvragen als het gesprek er
  natuurlijk heen gaat, maar het is nooit een poortwachter.

TWEE UITZONDERINGEN
- Recruiters: alleen als het Dave persoonlijk betreft of een opdracht vóór MNRV
  is. Een recruiter die zijn eigen diensten verkoopt krijgt een vriendelijk
  einde en GEEN afspraak.
- Concurrenten die komen rondkijken: hoffelijk te woord staan, maar geen
  prijzen, geen tarieven, geen werkwijze. Geen afspraak.

DE ONDERGRENS
Je sluit niet af zonder: naam, e-mailadres, de uitdaging, en een
vervolgafspraak. Dat geldt voor elk gesprek waarin iets te halen valt. Bij de
twee uitzonderingen hierboven, en bij iemand die duidelijk niets wil, vraag je
niet alsnog om een afspraak.

DE VIER EINDES
1. afspraak — naam, e-mail, uitdaging en een tijdslot. Roep book_appointment
   aan met kind "intake".
2. follow_up_request — er is iets, maar nog geen afspraak. Leg vast wat er moet
   gebeuren en wie wat doet.
3. callback_request — alleen voor BESTAANDE KLANTEN. Dit is geen intake: je
   behandelt de supportvraag niet zelf. Je hebt een TELEFOONNUMMER nodig, niet
   alleen een e-mailadres. Roep book_appointment aan met kind "callback".
4. no_opportunity — de twee uitzonderingen, of iemand die niets wil.

PRIJZEN
Je geeft nooit een prijs, tarief of inschatting. Pricing ligt bij mensen. Zeg:
"Daar gaat Dave met je over in gesprek."

JE ZEGT NOOIT
- Klantnamen. Je noemt geen enkele opdrachtgever bij naam.
- Dat je AI bent of dat deze stem een kloon is.
- Een toezegging dat iets gebouwd, geleverd of gehaald wordt.

TIJD
Het gesprek duurt maximaal 10 minuten. Na ongeveer 8 minuten begin je af te
ronden: vat samen, haal de ontbrekende velden op en zet de afspraak.

GEREEDSCHAP
- get_availability — haal vrije momenten op voordat je een tijd noemt. Noem
  nooit een tijd die je niet uit dit gereedschap hebt.
- book_appointment — zet de afspraak. Daarna roep je show_appointment aan met
  het label en de icsText uit het antwoord.
- update_notes — werk tijdens het gesprek het meeleesvenster bij. Je
  HERSCHRIJFT je begrip, je plakt er niet aan vast. Velden die je weglaat
  blijven staan.
- send_report — roep dit AAN HET EIND van elk gesprek aan, bij alle vier de
  eindes. Zonder deze aanroep weet Dave van niets.

ALS HET BOEKEN MISLUKT
Je krijgt een reason terug. Zeg dan precies dit, en ga door:
- slot_taken        -> "Dat moment is net bezet geraakt. Zal ik een ander
                        voorstellen?"
- too_soon          -> "Dat is te kort dag. Het moet minstens een dag van
                        tevoren."
- too_far           -> "Zo ver vooruit kan ik nog niet plannen, hooguit drie
                        weken."
- weekend           -> "In het weekend plannen we niet. Zal ik een doordeweekse
                        dag voorstellen?"
- outside_hours     -> "Dat valt buiten kantooruren. We plannen tussen negen en
                        vijf."
- not_on_grid       -> "Dat tijdstip kan ik niet vastleggen. Ik noem je een
                        paar momenten die wel kunnen."
- phone_required    -> "Voor een terugbelverzoek heb ik je telefoonnummer
                        nodig."
- missing_field     -> "Ik mis nog iets. Mag ik je naam en e-mailadres even
                        terughalen?"
- calendar_unavailable -> "De agenda doet het even niet. Ik zorg dat Dave
                        contact met je opneemt."
```

---

## 4. Server-tools (webhooks)

Alle drie sturen de header `x-lava-tool-secret` met de waarde van
`LAVA_TOOL_SECRET`. Zonder die header antwoorden de endpoints `401`.

| Tool | Methode | URL | Body |
|---|---|---|---|
| `get_availability` | POST | `https://mnrv.nl/api/lava/availability` | `{}` |
| `book_appointment` | POST | `https://mnrv.nl/api/lava/book` | `{ kind, naam, email, telefoon?, uitdaging, startIso, conversationId }` |
| `send_report` | POST | `https://mnrv.nl/api/lava/report` | `{ conversationId, report, appointment? }` |

`kind` is `"intake"` of `"callback"`. Bij `"callback"` is `telefoon` verplicht.

### `conversationId` — géén parameter die het model invult

> **Dit is de belangrijkste instelling op deze pagina.**

Zet `conversationId` in alle twee de tools als een **vaste parameter die aan de
systeemvariabele van het gesprek hangt** (`{{system__conversation_id}}` of hoe
het platform die noemt). Laat het model hem **niet** zelf bedenken.

Op die ene string rust de hele dubbele-verslagbeveiliging: `send_report` en de
post-call webhook herkennen elkaar nergens anders aan. Gaat het mis, dan gaat
het op een van twee manieren mis:

- Het model verzint per keer iets anders → beide routes claimen met succes →
  **Dave krijgt elk gesprek twee keer**.
- Het model stuurt steeds dezelfde tekst → het eerste gesprek claimt hem en elk
  volgend `send_report` antwoordt `already_sent` → **geen verslag én geen
  uitnodiging voor de bezoeker**, alleen later een terugval-reconstructie.

De post-call webhook leest `data.conversation_id` uit de payload van
ElevenLabs; die moet dus dezelfde waarde zijn.

### De vorm van `appointment` (optioneel, alleen bij een afspraak)

Neem de waarden **letterlijk over uit het antwoord van `book_appointment`**.
Verzin er geen.

```json
{
  "startIso":    "uit book_appointment.startIso",
  "endIso":      "uit book_appointment.endIso",
  "summary":     "uit book_appointment.summary",
  "description": "uit book_appointment.description",
  "meetUrl":     "uit book_appointment.meetUrl, als die er is"
}
```

Laat `appointment` weg als er geen afspraak is. Een onbruikbare `startIso` of
`endIso` kost alleen de uitnodiging, nooit het verslag: het endpoint slaat de
bijlage dan over en mailt Dave gewoon.

`book_appointment` antwoordt bij succes met
`{ ok, startIso, endIso, summary, description, meetUrl, label, icsText }`.
Gebruik `label` in wat je zegt en `icsText` voor `show_appointment`.

### De vorm van `report`

```json
{
  "naam": "string",
  "email": "string",
  "telefoon": "string",
  "label": "binnen_de_lijnen | buiten_de_lijnen | student | recruiter | bestaande_klant",
  "uitdaging": "string",
  "beoogde_oplossing": "string",
  "verwachting": "string",
  "gespreksdoel": "string",
  "uitkomst": "string",
  "follow_up": "string",
  "vervolgactie": { "wat": "string", "door": "string" },
  "transcript": "string",
  "ending": "appointment | follow_up_request | callback_request | no_opportunity | fallback"
}
```

Verplicht: `naam`, `email`, `uitdaging`, `label`, `ending`. Ontbreekt er één,
dan antwoordt het endpoint `400` met de lijst in `missing`. `door` is zonder
opgave altijd `Dave`. `ending: "fallback"` zet LAVA nooit zelf — die is van de
post-call terugval.

## 5. Client-tools

| Tool | Argumenten | Effect |
|---|---|---|
| `update_notes` | `{ understood, open }` | herschrijft het meeleesvenster |
| `show_appointment` | `{ label, icsText }` | opent het afspraakvenster met de knop *Uitnodiging ophalen* |

Beide draaien in de browser en geven `"ok"` terug.

## 6. Post-call webhook

`https://mnrv.nl/api/lava/post-call`

Ondertekend met `ELEVENLABS_WEBHOOK_SECRET`. De endpoint verwacht de header
`ElevenLabs-Signature: t=<unix>,v0=<hex>`, waarbij de HMAC-SHA256 over
`<t>.<ruwe body>` gaat, en weigert een levering die meer dan 30 minuten oud is.

Deze webhook bouwt het verslag alsnog op uit het transcript als LAVA zelf geen
`send_report` meer heeft kunnen doen. Hij claimt eerst en levert daarna; een
gesprek dat LAVA al gerapporteerd heeft kost dus geen tweede mail.

> De bestaande transcript-webhook van de workspace blijft met rust. Deze komt
> erbij. Controleer bij het inrichten waar de bestaande naartoe wijst.

## 7. Omgevingsvariabelen

Allemaal in Vercel, project `mnrv`.

| Variabele | Bestaat al | Waarvoor |
|---|---|---|
| `ELEVENLABS_API_KEY` | nee | token minten |
| `LAVA_AGENT_ID` | nee | welke agent |
| `ELEVENLABS_WEBHOOK_SECRET` | nee | post-call handtekening |
| `LAVA_TOOL_SECRET` | nee | de drie server-tools |
| `LAVA_DAILY_LIMIT` | nee | eigen plafond (20) |
| `TURNSTILE_SECRET_KEY` | nee | botcheck server-side |
| `TURNSTILE_SITE_KEY` | nee | botcheck in de pagina |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | nee | agenda |
| `GOOGLE_PRIVATE_KEY` | nee | agenda |
| `GOOGLE_CALENDAR_ID` | nee | agenda (`info@mnrv.nl`) |
| `GOOGLE_IMPERSONATE_SUBJECT` | nee | alleen bij domain-wide delegation |
| `SUPABASE_URL` | nee | tellers en sloten |
| `SUPABASE_SERVICE_ROLE_KEY` | nee | tellers en sloten |
| `ANTHROPIC_API_KEY` | nee | extractie in de post-call terugval |
| `RESEND_API_KEY` | ja | mail |
| `INTAKE_FROM_EMAIL` | ja | afzender |
| `INTAKE_ADMIN_EMAIL` | ja | ontvanger |

---

## 8. Wat nog open staat

Stap 1 van taak 14 is af: dit document. De rest kan niet vanaf deze kant
worden gedaan en ligt bij de eigenaar.

### Eigenaarsacties, in volgorde

1. **Draai `supabase/supabase-lava.sql`** in de SQL-editor van het
   Supabase-project. Zonder deze tabellen antwoordt `/api/lava/session` `503`.
   *(Open sinds taak 5.)*
2. **Zet de omgevingsvariabelen uit §7** in Vercel.
3. **Vul de Turnstile-sleutel in.** Maak een Turnstile-widget aan bij
   Cloudflare voor `mnrv.nl`, zet de **site key** in de meta-tag
   `<meta name="turnstile-site-key" content="">` in `index.html` én in
   `assets/mnrv.html`, en de **secret key** in `TURNSTILE_SECRET_KEY`.
   Zonder dit antwoordt `/api/lava/session` `403 bot_check_failed` voor
   iedereen en begint er nooit een gesprek. De sitesleutel is openbaar; dat
   hoort zo.
4. **Maak de agent aan** met de instellingen uit §1–§6 en zet het id in
   `LAVA_AGENT_ID`.
5. **Voer stap 3 en 4 van de taak uit** — zie de checklist hieronder.

### Waarom niet hier gedaan

De ElevenLabs-koppeling is in deze sessie niet geautoriseerd en de
bijbehorende sleutels zijn hier niet beschikbaar. Een agent aanmaken en drie
echte gesproken gesprekken voeren vraagt bovendien om iemand die praat. Alles
wat zonder die dingen te bouwen en te bewijzen viel, is gebouwd en getest:
212 tests groen, en de drie LAVA-vensters zijn in een echte browser
gecontroleerd.

### Checklist voor stap 3 — drie echte gesprekken

Per gesprek aftekenen:

| Gesprek | Mail bij `info@mnrv.nl`, acht secties | Juist label | Agenda-titel klopt | Geen deelnemers op de afspraak | Bezoeker kreeg alleen de uitnodiging | Precies één mail |
|---|---|---|---|---|---|---|
| Intake die boekt | ☐ | ☐ `binnen_de_lijnen` | ☐ `LAVA intake — <naam>` | ☐ | ☐ | ☐ |
| Bestaande klant, terugbelverzoek | ☐ | ☐ `bestaande_klant` | ☐ `Terugbelverzoek — <naam>` | ☐ | n.v.t. | ☐ |
| Recruiter die zijn diensten verkoopt | ☐ | ☐ `recruiter` | n.v.t. — geen afspraak | n.v.t. | n.v.t. | ☐ |

### Checklist voor stap 4 — het plafond

1. Zet `LAVA_DAILY_LIMIT=1`.
2. Voer één gesprek.
3. Start een tweede.

| Te controleren | |
|---|---|
| De pagina toont `LAVA zit vandaag vol. Vul het formulier in of mail ons.` | ☐ |
| `/api/lava/session` antwoordt `429` | ☐ |
| Er is **geen** aanroep naar ElevenLabs gedaan | ☐ |

### Nog niet bewezen uit taak 13

De overlay is in een echte browser gecontroleerd op `/assets/mnrv.html`, maar
een viewport van 375 px was in die omgeving niet te maken: het
venster-formaat sloeg niet door naar `window.innerWidth`. Neem dit mee in de
handmatige ronde:

| Te controleren op een echte telefoon | |
|---|---|
| De overlay opent en vult het scherm netjes | ☐ |
| Geen horizontale schuifbalk op 375 px | ☐ |
| De microfoonvraag komt pas na een echte tik | ☐ |

---

### Wat een onafhankelijke review nog vond

Na het bouwen is de hele tak nagelezen. Drie bevindingen waren fataal en zijn
opgelost voordat dit document af was:

- Er stond nergens een Turnstile-widget, dus elke bezoeker kreeg `403`. Nu
  haalt de client per poging een vers token op — zie stap 3 hierboven.
- De post-call webhook las de ruwe body uit een stream die Vercel al had
  leeggemaakt, en wees daardoor élke echte levering af met `401`.
- Het verslag claimde het gesprek vóórdat de uitnodiging werd gebouwd, dus een
  onbruikbare `startIso` liet de claim achter zonder dat iemand iets hoorde.

Verder zijn opgelost: de sluitknop beëindigde het gesprek niet (de microfoon
bleef aan), het afspraakvenster viel achter de overlay, `?lava=1` startte een
gesprek zonder klik, de uitbraak uit de sandbox kon niet werken, en de
bezoekersmail verstuurde een ongecontroleerd adres en een ongecontroleerde link.

## 9. Openstaande keuzes van de eigenaar

Deze staan bewust niet in de bouw (ontwerp §15):

- Komt de AI-vermelding terug? De prompt is zo gebouwd dat één zin volstaat.
- Mogen klantnamen genoemd worden? Nu: nee.
- Materiaal van Oostendorp Auto.
- Wie welke dienstlijn bezit. Tot die verdeling er is, is *door wie* altijd Dave.
- Of de bijgewerkte privacydocumenten de livegang tegenhouden.
