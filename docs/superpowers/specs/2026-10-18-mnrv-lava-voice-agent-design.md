# LAVA — gesproken intake-agent voor mnrv.nl

**Datum:** 2026-10-18
**Status:** ontwerp, nagelezen door een bouwerscheck, wacht op goedkeuring
**Opdrachtgever:** Dave (MNRV)

---

## 1. Wat dit is

LAVA is een gesproken intakegesprek in de browser van mnrv.nl. Een potentiële
klant klikt op een knop, er opent een venster, en hij praat met LAVA om erachter
te komen wat MNRV voor hem kan betekenen. ElevenLabs verzorgt de stem en de
gespreksregie, Claude is het model dat denkt.

Het is een **webapp op mnrv.nl**, en niets anders: geen telefoonlijn, geen
chatbubbel met tekst, geen WhatsApp. In de Win98-vormgeving van de site is het
letterlijk een venster: `LAVA.exe`.

## 2. Waarom nu

MNRV heeft zes dienstlijnen waarvan vijf geen website zijn, en één intakeformulier
dat volledig over websites gaat. Een bezoeker die komt voor workforce automation
of een private kennislaag past daar niet in. Het formulier vraagt dertig velden
uit waarvan er drie verplicht zijn, en het stelt geen enkele vraag die uitvindt
wat iemand eigenlijk nodig heeft.

LAVA doet wat een formulier niet kan: doorvragen, het haakje vinden, en de juiste
richting kiezen voordat er een afspraak staat.

## 3. Waar we op afrekenen

**Succes is:** LAVA levert leads van waarde aan die Dave kan opvolgen.

Dat is expliciet geen aantal gesprekken. Belangrijk daarbij: LAVA filtert **niet
aan de deur** (zie §4.1). Vrijwel iedereen is welkom en krijgt een intake. Het
onderscheiden van waardevolle en minder waardevolle leads gebeurt in het
verslag, niet in het gesprek — LAVA stuurt niemand weg, maar benoemt eerlijk wat
voor aanvraag het is, zodat Dave kan beoordelen wat hij ermee doet.

### Doelen

1. De bezoeker hangt op met het gevoel dat hij begrepen is en weet wat MNRV voor
   hem kan doen.
2. Dave krijgt per gesprek één leesbaar verslag waaruit hij kan opvolgen zonder
   het gesprek te hebben gehoord.
3. Bij een echte kans staat er een afspraak in de agenda voordat het gesprek
   eindigt.
4. LAVA vindt zelf de juiste dienstlijn, ook als de bezoeker die niet kent.

### Non-goals

- Geen prijsopgave of quote. Pricing blijft bij mensen.
- Geen support of klantenservice. Bestaande klanten krijgen een terugbelverzoek
  (§4.3), geen inhoudelijke hulp.
- **Geen telefonie, geen uitbellen, geen WhatsApp.** Er hangt een Twilio-nummer
  aan de ElevenLabs-workspace (`+3197010288256`, label "Mnrv"); dat blijft
  ongemoeid en wordt niet aan LAVA gekoppeld.
- Geen vervanging van het intakeformulier. Dat blijft bestaan als uitweg.
- Geen opslag van gesprekken in een eigen database.

### Anti-goals — hiermee is het mislukt, ook als het technisch werkt

- **Het wordt een verhoor.** Een reeks vragen afwerken is precies wat LAVA niet
  is. Liever een gat in het verslag dan een vragenlijst.
- **LAVA belooft iets dat MNRV niet kan leveren.** Een aanvraag buiten de zes
  lijnen mag hij aannemen, maar hij mag niet toezeggen dát het gebouwd wordt. Hij
  neemt op en legt vast; Dave beslist. *(Mijn lijn, expliciet zo voorgelegd.)*
- **Het verslag verbloemt wat voor lead het is.** Omdat er niet aan de deur
  gefilterd wordt, is een eerlijk label het enige dat Dave beschermt tegen een
  agenda vol niets.
- **De bezoeker voelt zich bekeken.** Het meelezende venster moet helpen, niet
  controleren.

## 4. Hoe het gesprek werkt

### 4.1 Wie er welkom is

Vrijwel iedereen. Dit is uitdrukkelijk zo bepaald door de opdrachtgever:

- **Zakelijke aanvragen binnen de zes lijnen** — de kern.
- **Webdesign, app-ontwikkeling en andere projecten, ook als MNRV die niet op de
  site beschrijft.** Die neemt LAVA op en doet hij intake voor. Hij belooft niet
  dat het gebouwd wordt; dat is Dave's beslissing.
- **Studenten en scriptievragen zijn welkom.** Geen afwijzing, geen korte
  afhandeling. LAVA voert het gesprek en benoemt in het verslag wat het is.
- **Geen budgetdrempel.** Er is geen bedrag waaronder LAVA afhaakt. Alles is
  bespreekbaar. Hij mag budget wel uitvragen als het gesprek er natuurlijk
  heengaat, maar het is geen poortwachter.

Twee uitzonderingen:

- **Recruiters:** alleen als het Dave persoonlijk betreft of een opdracht voor
  MNRV is. Een recruiter die zijn eigen diensten verkoopt krijgt een vriendelijk
  einde en geen afspraak.
- **Concurrenten die komen rondkijken:** hoffelijk te woord staan, maar **geen
  prijzen, geen tarieven en geen werkwijze**. Geen afspraak. *(Het "geen
  afspraak" is mijn aanvulling.)*

### 4.2 De ondergrens

LAVA mag niet weglopen zonder: **naam, e-mail, de uitdaging, en een
vervolgafspraak.**

Dat geldt voor elk gesprek waarin iets te halen valt. Bij de twee uitzonderingen
hierboven, en bij iemand die er duidelijk niets van wil, hoort LAVA niet alsnog
om een afspraak te vragen.

### 4.3 De vier eindes

1. **Afspraak.** Naam, e-mail, uitdaging en een tijdslot in de agenda. De
   bezoeker krijgt een `.ics` om op te halen, Dave krijgt het verslag per mail.
2. **Follow-up.** Er is wel iets, maar nog geen afspraak. LAVA legt vast wat er
   moet gebeuren en wie wat doet.
3. **Terugbelverzoek.** Voor **bestaande klanten**. Geen intake — zij plannen een
   terugbelmoment in. Dit vraagt een telefoonnummer in plaats van alleen een
   e-mailadres, en komt als een eigen afspraaksoort in de agenda
   (`Terugbelverzoek — [naam]`). LAVA behandelt de supportvraag zelf niet.
4. **Geen kans.** LAVA wenst een fijne dag en spreekt de wens uit nog eens te
   spreken. Geen afspraak, geen druk. Dit einde is door §4.1 zeldzaam.

### 4.4 Dialoog, geen formulier

Dit is de kern van het ontwerp en het makkelijkst verkeerd te bouwen.

De dingen die MNRV moet weten komen boven **in het gesprek**. LAVA hoort iets,
haakt erop in, en komt zo achter wat hij nodig heeft. Er is geen veldenlijst die
hij afwerkt en geen formulier dat zichzelf invult. Pas aan het eind vat hij alles
samen, en **die samenvatting is de intake**.

Het bestaande `intakeformulier.html` is daarbij hoogstens inspiratie voor wat je
wil weten. Het is expliciet geen blauwdruk: hou je er niet aan vast.

Per dienstlijn is er een handvol dingen waarmee LAVA thuis moet komen, afgeleid
uit de proposities in §6. De rest mag hij laten liggen als het gesprek er niet
heen gaat. Twee gesprekken over dezelfde dienst leveren dus verschillende
verslagen op, en dat is goed.

### 4.5 Gesprekslengte

Tien minuten maximaal. LAVA begint zelf af te ronden rond de acht minuten, zodat
een gesprek niet wordt afgekapt midden in het maken van een afspraak.
*(Mijn keuze.)*

## 5. Wie LAVA is

**Persona:** expert, consultant, inspirator, motivator, meegaand, meedenkend,
flexibel, sparringpartner, senior AI-specialist.

**Toon:** droog en vakkundig in wát hij zegt. De nostalgie zit volledig in de
vormgeving, niet in de inhoud — het gesprek gaat over budgetten vanaf €10.000 en
over AI-governance, en daar past geen Win98-grapje bij.

**Stem:** de bestaande kloon **David** in Dave's ElevenLabs-workspace,
`4giVXkrLUjoVUeP6Gqol`, nl-brabantian. Stijl zoals vastgelegd bij die stem:
"conversational, spontaneous and human. Slightly dry humor where appropriate.
Never overact. Reads as if explaining something to one person instead of
performing for a large audience."

**Taal:** Nederlands als vertrekpunt. Spreekt iemand hem in het Engels aan, dan
gaat LAVA in het Engels verder met dezelfde stem. Zijn openingszin blijft
Nederlands. Hij houdt in het Engels zijn Brabantse tongval; dat is geaccepteerd.

### Openingszinnen

> "Je spreekt met LAVA van MNRV. Ik ben er om uit te zoeken wat MNRV voor je kan
> doen, en als het past zet ik meteen een afspraak in de agenda. Vertel eens,
> waar loop je tegenaan?"

**Besluit van de opdrachtgever:** LAVA meldt voorlopig **niet** dat hij AI is, en
niet dat de stem een kloon van Dave is. Dit is uitdrukkelijk zo besloten nadat
het punt tweemaal is opgebracht, inclusief de juridische kant.

Wat daarbij op tafel lag, voor als dit later heroverwogen wordt: artikel 50 van
de EU AI Act geldt sinds 2 augustus 2026 en vraagt dat iemand uiterlijk bij de
eerste interactie weet dat hij met AI praat, duidelijk en te onderscheiden. De
uitzondering voor "overduidelijk AI" werkt hier averechts, omdat een gekloonde
menselijke stem het tegenovergestelde suggereert. MNRV verkoopt zelf
AI-governance. De formulering die klaarligt als het terugkomt:

> "Je spreekt met LAVA, de AI van MNRV. De stem die je hoort is een kloon van
> Dave — met zijn toestemming, maar hij zit er niet bij. [...]"

Deze beslissing hoort bij de opdrachtgever, niet bij de bouwer. Bouw wat hier
staat; verander het niet op eigen initiatief, maar bouw het wel zo dat één
tekstwijziging genoeg is om het aan te zetten.

### Toestemming voor de transcriptie

LAVA vraagt dit op het moment dat het relevant is, niet in de opening:

> "Ik schrijf dit gesprek uit en stuur het naar Dave — mag ik je naam en e-mail?"

*(Mijn keuze: dit valt samen met het moment waarop die gegevens toch nodig zijn,
en vijf mededelingen voor de eerste vraag is te veel.)*

## 6. Wat LAVA moet kennen

LAVA wordt ingeleerd via de knowledge base van het platform. Daarin gaan:

- de zes vernieuwde proposities hieronder, inclusief de conversiehaken;
- de site zelf: `index.html`, `assets/mnrv.html`, `portfolio.html`;
- de USP's: alles onder één dak, lokale AI en private LLM's, AI Act- en
  AVG-governance, begeleiding bij adoptie;
- het team: Andrew, Dave, Arpit, Rick.

**Klantnamen noemt LAVA niet.** FAINL, Windofy, De Notenman en Oostendorp Auto
blijven buiten zijn mond tot de opdrachtgever daar expliciet toestemming voor
geeft. Van Oostendorp Auto staat in de repo alleen een logo en geen enkele tekst,
dus die case blijft helemaal uit de kennisbank — anders moet LAVA verzinnen wat
MNRV voor ze gedaan heeft, en dat is een anti-goal. *(Mijn keuze bij gebrek aan
materiaal; de andere drie cases hebben wel tekst in
`components/Portfolio/src/index.html` maar zonder resultaten of cijfers.)*

De proposities zijn **geen dienstenlijst om voor te lezen** — ze zijn LAVA's
gespreksargumenten. De conversiehaak is wat hij gebruikt als hij merkt dat een
bezoeker op die lijn zit.

### 01 / Web — Websites & apps

Digitale producten en platforms die niet alleen snel en toegankelijk zijn, maar
ook vindbaar en overtuigend voor zowel mensen als AI-systemen. Met een
conversiegerichte architectuur, duurzame technische fundamenten en een UX die
vertrouwen opbouwt vanaf de eerste seconde. Ontworpen om te presteren in een
zoeklandschap waarin AI-gedreven verkeer een steeds groter aandeel van je
pipeline bepaalt.

> "Je website is in 2027 je beste salesmedewerker — of je duurste gemiste kans."

### 02 / AI — Agentic AI & autonome assistenten

Van chatbots die antwoorden naar agents die handelen. Autonome AI-agenten die
zelfstandig beslissingen nemen binnen jouw workflows, taken afronden en
samenwerken met je teams. In 2027 verwacht 67% van de bedrijven dat AI-agenten
autonoom beslissingen nemen in operationele processen. Wij bouwen de
infrastructuur, de guardrails en de integraties om die transitie verantwoord te
maken — niet als pilot, maar als onderdeel van je dagelijkse operatie.

> "De vraag is niet óf je AI-agenten krijgt, maar of ze namens jou de juiste
> beslissingen nemen."

### 03 / Tools — Maatwerk & integraties

Het zenuwstelsel van je organisatie. We verbinden systemen, data en teams tot één
werkende keten — met maatwerk waar het moet en standaardintegraties waar het kan.
Duurzaam gebouwd, zodat je over drie jaar niet opnieuw hoeft te beginnen. En
klaar voor een ecosysteem waarin AI-agenten niet alleen jouw tools gebruiken,
maar er ook zelfstandig mee samenwerken.

> "Systemen die met elkaar praten, processen die zichzelf versnellen."

### 04 / Workforce — Workforce automation

Van handmatige planning naar zelfsturende operatie. Workforce automation die
verder gaat dan dashboards: AI-gestuurde forecasting, skills-based matching en
autonome planning. De markt beweegt naar systemen die zelfstandig open diensten
invullen op basis van skills en preferenties. Gartner voorspelt dat AI-gedreven
automatisering diep geïntegreerd raakt in workforce management om operationele
inefficiënties en managementuitval te reduceren. Wij bouwen de brug tussen je
huidige processen en die autonome toekomst — zonder de mens uit het oog te
verliezen.

> "Plan niet met spreadsheets. Plan met intelligentie."

### 05 / Reviews — Reputatie-intelligentie

Reputatie is allang geen sterrenscore meer. Het speelt zich af op een vierde,
veel minder zichtbaar oppervlak: wat AI-engines zoals ChatGPT, Perplexity en
Gemini over je merk zeggen wanneer iemand er direct naar vraagt.
Reputatie-intelligentie betekent in 2027 dat je niet alleen reviews monitort,
maar ook AI-antwoordpatronen volgt, context interpreteert en urgentie rangschikt.
Wij bouwen systemen die je reputatie bewaken op alle relevante oppervlakken — van
klassieke reviewplatformen tot de conversaties die je merk vormgeven buiten je
zicht.

> "Je reputatie wordt niet alleen door klanten gevormd. AI vertelt het verhaal
> door."

### 06 / Knowledge — Kennisinfrastructuur voor mens en AI

Kennis die werkt voor iedereen — mens én machine. Een centrale, betrouwbare
kennislaag waarin bedrijfskennis, processen en antwoorden niet alleen vindbaar
zijn, maar ook activeerbaar voor AI-assistenten en autonome agenten. Met de
opkomst van kennisgrafen en semantische lagen wordt kennis niet langer opgesloten
in documenten, maar bruikbaar als directe input voor beslissingen. Duurzaam,
governable en gebouwd om mee te groeien — zodat je kennisinfrastructuur over vijf
jaar nog steeds de bron van waarheid is.

> "Je kennis is alleen waardevol als je systemen hem kunnen gebruiken."

## 7. Wat eruit komt

Elk gesprek levert één verslag op, ongeacht welke dienstlijn het werd. Deze acht
punten zijn letterlijk door de opdrachtgever benoemd:

1. **De uitdaging** — wat loopt er vast
2. **De beoogde oplossing** — wat de klant zelf voor zich ziet
3. **Wat ze verwachten** — van MNRV, van het traject
4. **Het doel van het gesprek** — waarom hij LAVA opende
5. **De uitkomst van het gesprek** — wat er is besloten
6. **Follow-up actie** — wat LAVA aan de klant heeft toegezegd
7. **Vervolgactie** — wat er bij MNRV moet gebeuren, en door wie
8. **Transcriptie** — het volledige gesprek, woord voor woord

*Punten 6 en 7 als twee kanten (klant versus intern) is mijn interpretatie van de
twee termen die de opdrachtgever noemde; hij heeft dat niet zo gezegd.*

Daarbovenop, omdat er niet aan de deur gefilterd wordt (§3): **een eerlijk label
van wat voor aanvraag dit is** — binnen de zes lijnen, buiten de lijnen, student,
recruiter, bestaande klant. Zonder dat label moet Dave elk verslag lezen om te
weten of het iets is. *(Mijn toevoeging.)*

Het verslag moet leesbaar zijn voor iemand die het gesprek niet heeft gehoord.
Doorlopende tekst waar dat kan, geen veldenlijst met lege plekken. Waar LAVA iets
niet weet staat dat er, eerlijk, als ontbrekend — niet verzonnen.

**Punt 7 wijst standaard Dave aan** als degene die opvolgt. De site heeft bio's
voor Andrew, Dave, Arpit en Rick, maar niets legt vast wie welke dienstlijn
bezit; tot die verdeling er is, is "door wie" altijd Dave. *(Mijn keuze.)*

### Wie het verslag schrijft

LAVA stelt de samenvatting zelf op in een tool-call op het moment dat hij afrondt
— hij bestuurt alle vier de eindes, dus hij weet wanneer dat is. Daarnaast komt
er een server-side terugval: sluit de bezoeker het venster zonder afronding, dan
wordt het verslag na het gesprek opgebouwd uit de transcriptie. Zonder die
terugval verdwijnt een half gesprek zonder spoor. *(Mijn keuze; dit was de
architectuurvraag uit de bouwerscheck.)*

De bestaande transcript-webhook van de workspace blijft met rust gelaten — er
komt een eigen post-call webhook naar mnrv.nl bij in plaats van de huidige om te
leiden. Waar die bestaande naartoe wijst moet bij het bouwen worden gecontroleerd,
niet geraden.

### Aflevering

- **Naar Dave:** één mail naar `info@mnrv.nl` met het verslag en, als er een
  afspraak is, de `.ics` als bijlage.
- **Naar de klant:** een mail met alleen de uitnodiging. De klant wordt **niet**
  als deelnemer aan de agenda-afspraak toegevoegd, anders stuurt Google er zijn
  eigen uitnodiging bij en krijgt hij er twee. *(Mijn keuze.)*
- **De transcriptie** blijft daarnaast aan de ElevenLabs-kant staan. Er komt geen
  eigen database voor gesprekken.

De mailroute bestaat al: `api/send-intake-mail.js` stuurt via Resend vanaf
`intake@mnrv.nl` naar `info@mnrv.nl` met een kopie naar de klant, en Resend
ondersteunt bijlagen.

## 8. De agenda

LAVA mag in de agenda kijken **en de afspraak er direct zelf in zetten**. Dat is
bewust zo gekozen: zonder schrijfrechten biedt hij twee gelijktijdige bezoekers
hetzelfde tijdslot aan.

**De agenda is `info@mnrv.nl`**, en dat is bevestigd als de agenda waar Dave echt
in werkt, privé-afspraken inbegrepen als bezet. Vrij/bezet daar is dus te
vertrouwen.

### Boekregels

Voorgesteld en niet weersproken; dit is mijn keuze geworden:

- werkdagen, 9:00–17:00, tijdzone Europe/Amsterdam;
- een half uur per gesprek;
- minimaal 24 uur vooruit, maximaal drie weken vooruit;
- maximaal twee LAVA-afspraken per dag;
- pas boeken nadat naam, e-mail en de uitdaging er zijn;
- titel `LAVA intake — [naam]`, of `Terugbelverzoek — [naam]` bij einde 3, zodat
  de herkomst meteen zichtbaar is.

**Soort afspraak:** een videogesprek van een half uur met een Meet-link. Bij een
terugbelverzoek een telefonisch moment, met het nummer in de afspraak. *(Mijn
keuze.)*

### Koppeling

Server-side, want LAVA draait op mnrv.nl en niet in iemands Claude-sessie. Bij
een Google Workspace-account is een service-account met domain-wide delegation de
schoonste route; anders eenmalig OAuth met een refresh-token in de
Vercel-omgevingsvariabelen. Dat is geen "eigen database voor gesprekken" en dus
geen schending van het non-goal. Welke van de twee kan pas bij het bouwen worden
vastgesteld.

## 9. Waar LAVA start

**Op de Win98-desktop (`index.html`):** het bestaande icoon **"My LAVA"**
(`assets/icons/Computer_32x32_4.png`, `data-window="lava-window"`) wordt de start
van `LAVA.exe`. Het huidige venster met `omnicontent.nl` in een iframe verdwijnt
— expliciet bevestigd. Dat venster toont trouwens op dit moment niets: omnicontent.nl
is een geparkeerd STRATO-domein zonder content.

**Op de moderne route (`assets/mnrv.html`):** twee bestaande CTA's starten LAVA.

- regel ~1564: `<a href="#contact" class="btn-primary">Start een project</a>`
- regel ~1735: `<button id="open-intake-modal">Okaayy, let's go!</button>`

Onder de knop komt een kleine uitweg: *"liever typen? vul het formulier in"*.
*(Mijn keuze.)* Een deel van de bezoekers zit op kantoor, heeft geen microfoon of
praat niet tegen software; zonder uitweg verlies je die leads. Het is ook waar
LAVA naar wijst als hij vol zit.

### Twee valkuilen in de bestaande site

1. **`assets/mnrv.html` wordt op twee manieren geopend.** Via het bureaubladicoon
   (`index.html:224`), het startmenu (`:487`) en een redirect (`:771`) is het een
   gewone navigatie — daar werkt een microfoon normaal. Maar `portfolio.html:153`
   toont diezelfde pagina óók in een IE-venster, in
   `sandbox="allow-scripts allow-popups allow-forms allow-presentation"` zonder
   `allow-same-origin`. Dat is een opaque origin, en `getUserMedia` werkt daar
   niet, met welke header dan ook. **Oplossing:** binnen dat iframe opent de knop
   niet LAVA zelf, maar stuurt hij een bericht naar de bovenliggende pagina, die
   `LAVA.exe` op het bureaublad opent. Dat past ook beter bij de metafoor — een
   programma hoort op het bureaublad, niet in de browser-in-de-browser. *(Mijn
   keuze.)*
2. **`vercel.json` geeft site-wide microfoon, camera, locatie, klembord,
   schermopname en autoplay weg** aan `https://omnicontent.nl` — een geparkeerd
   domein. Die delegatie gaat eruit zodra het iframe verdwijnt; `self` blijft, dat
   heeft LAVA nodig. *(Mijn keuze.)*

## 10. De interface

De vorm is gekozen uit drie varianten (alleen stem / stem naast formulier /
LAVA.exe). Gekozen is **LAVA.exe**: een echt Win98-venster, zodat LAVA het merk
van de site erft. Het bestaande `win98-authenticity-guard`-skill houdt dat zuiver.

**Twee vensters:**

1. **`LAVA.exe`** — de orb, een VU-meter die meebeweegt, zijn laatste zin, en
   knoppen om te pauzeren en te beëindigen. Statusbalk met verbinding, duur en
   taal.
2. **"Wat LAVA begrijpt"** — LAVA's eigen begrip van het gesprek, in gewone
   doorlopende zinnen, dat zichzelf herschrijft terwijl het gesprek vordert.

Dat tweede venster is uit drie opties gekozen (geen tweede venster / notities /
het verslag dat meeloopt). De reden dat het de notities zijn en niet het verslag:
zodra de bezoeker velden ziet aftikken — "4 van 7 ingevuld" — gaat hij antwoorden
alsof het een formulier is, en dat is precies een anti-goal uit §3.

Het notitievenster schrijft ook op **wat LAVA nog niet weet**. Dat lokt uit dat de
bezoeker het zelf aanvult, zonder dat er een vraag gesteld is.

Corrigeren kan op twee manieren: tegen LAVA zeggen, of een knop "dit klopt niet"
in het notitievenster.

Aan het eind verschijnt een venster met de afspraak en een knop om de uitnodiging
op te halen.

**Mobiel doet mee in versie één.** Twee Win98-vensters naast elkaar passen niet op
360 pixels, dus het notitievenster krijgt daar een andere vorm — een strook of een
lade onder LAVA.exe, niet een tweede zwevend venster. Dat is ontwerpwerk, geen
CSS-correctie, en het is de grootste kostenpost in de bouw. Let daarbij op iOS
Safari: dat vraagt een echte gebruikersklik voordat de microfoon en het
geluidsafspelen opengaan.

De mockups staan in
`C:\Users\Thinkpat\Desktop\Klanten\LAVA\.superpowers\brainstorm\816-1792314913\content\`
(`lava-surface.html` voor de drie varianten, `tweede-venster.html` voor het
notitievenster). Er is nog geen mobiele mockup.

## 11. Hoe het gebouwd wordt

**Gekozen: LAVA wordt een agent in de bestaande ElevenLabs-workspace van MNRV,
met Claude als model.** De opdrachtgever heeft het platformdeel van deze keuze
aan mij gelaten ("de beste optie").

De reden: turn-taking, onderbreken en stemkwaliteit zijn daar af, en dat zijn
precies de dingen die zelf bouwen traag en duur maken. De workspace heeft al twee
agenten (SENTINEL, Omnia), dus de weg is bekend.

De businesslogica blijft bij MNRV: agenda, mail en verslag draaien op endpoints
in `api/`, die als webhook-tools aan de agent hangen. Als het platform ooit
vervangen wordt, verhuist het gesprek en niet de logica.

**Claude is een eis, geen voorkeur.** De opdracht begon met "een AI voice agent
met ElevenLabs-stem en AI-model Claude". Blijkt Claude op dit workspace-plan
alleen bereikbaar als custom LLM met een eigen Anthropic-key, dan komt die key
erbij — niet stilletjes terugvallen op een ander model. De exacte modelnaam moet
bij het bouwen worden gecontroleerd tegen wat het platform aanbiedt. De workspace
staat nu op `gemini-3-flash-preview`.

Wat in de workspace al klaarstaat:

- **Knowledge base met RAG per agent** — hier gaan de proposities en de site in.
  Geen eigen vector-opslag nodig.
- **Taaldetectie en language presets** voor de overgang naar Engels.
- **Tools** zijn leeg op één dummy na (`logmessage`). De enige opgeslagen secret
  is het Twilio-token, dus er is geen bestaande webhook-authenticatie om te
  hergebruiken: agenda en mail zijn echt greenfield.

De voorkant is geen ElevenLabs-widget maar de eigen Win98-vensters, dus de
verbinding loopt via hun SDK in de bestaande `js/` van de site.

## 12. Grenzen en misbruik

- **Twintig gesprekken per dag.** Expliciet door de opdrachtgever bepaald. Het
  platform staat nu op een daglimiet van 100.000 en ongelimiteerde
  gelijktijdigheid; dat gaat omlaag als achtervang.
- **De teller zit aan MNRV's kant**, niet bij het platform. Er komt een
  sessie-endpoint in `api/` dat het gesprekstoken uitgeeft; daar wordt geteld en
  geweigerd. Doet het platform het, dan ziet de browser alleen een geweigerde
  verbinding en kan LAVA niet zeggen dát hij vol zit — en dat is wel de eis. De
  teller is één waarde (Edge Config of één rij), geen gespreksopslag. *(Mijn
  keuze.)*
- **Bij een bereikt plafond valt LAVA niet stil.** Hij zegt dat hij vandaag vol
  zit en wijst naar het formulier of de mail, zodat een lead niet verdampt.
- **Een botcheck op de knop** (Turnstile of vergelijkbaar) voordat het token
  wordt uitgegeven. Een publieke knop zonder poortje geeft iedereen de
  mogelijkheid om MNRV's credits op te maken en indirect in een echte agenda te
  schrijven. *(Mijn keuze — dit voegt een externe dienst toe die niet besproken
  is.)*
- **Tien minuten per gesprek**, afronden vanaf acht.

## 13. Privacy

- **Opnames: 90 dagen. Transcripties: een jaar.** Voorgesteld en niet
  weersproken; nu staat het op onbeperkt met `record_voice: true` en zonder
  PII-verwijdering.
- **De privacyverklaring en verwerkersovereenkomst** (`MNRV_Privacyverklaring_12-06-2026.pdf`
  en `MNRV_Verwerkersovereenkomst_12-06-2026.pdf`, gelinkt vanaf
  `assets/mnrv.html`) moeten spraakopnames en een verwerker buiten MNRV dekken
  **voordat LAVA live gaat**. Dat is een taak met een eigenaar buiten de bouw en
  staat op het kritieke pad. *(Mijn keuze om het als voorwaarde te zetten; de
  opdrachtgever heeft dit niet bevestigd.)*
- Machineleesbare markering van synthetische audio (AI Act art. 50 lid 2) is nog
  niet gecontroleerd bij ElevenLabs.

## 14. Wat aan de bouwer wordt gelaten

- De systeemprompt van LAVA: hoe hij uitvraagt, hoe hij de juiste lijn vindt, hoe
  hij een haakje legt. Het ontwerp zegt wát hij moet bereiken en met welke toon,
  niet met welke zinnen.
- Per dienstlijn bepalen welk handvol dingen LAVA echt moet ophalen.
- De vorm van het verslag in de mail, binnen de acht punten en het label van §7.
- Hoe het notitievenster zich technisch bijwerkt tijdens het gesprek.
- De precieze Win98-opmaak van de vensters, binnen de bestaande stijl en het
  authenticity-guard-skill — inclusief de mobiele vorm van het tweede venster.
- Foutpad: wat de bezoeker ziet als de microfoon niet werkt, de verbinding
  wegvalt, of het model niet antwoordt.

## 15. Nog open

1. **Of de AI-melding later terugkomt** (§5). Nu bewust uit, op besluit van de
   opdrachtgever.
2. **Of klantnamen genoemd mogen worden** (§6). Nu niet.
3. **Materiaal over Oostendorp Auto**, als die case in de kennisbank moet.
4. **Wie welke dienstlijn bezit** (§7, punt 7). Nu altijd Dave.
5. **Google Workspace of los account** op `info@mnrv.nl` — bepaalt de
   authenticatieroute (§8).
6. **Of de bijgewerkte privacystukken een harde voorwaarde zijn** voor livegang
   (§13).

---

*Dit document is niet gecommitteerd: `MNRV-main` is op dit moment geen
git-repository.*
