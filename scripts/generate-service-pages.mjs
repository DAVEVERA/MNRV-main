import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(rootDir, 'diensten');
const siteUrl = 'https://mnrv.nl';

const services = [
  {
    number: '01',
    slug: 'websites-apps',
    navTitle: 'Websites & apps',
    title: 'Websites & apps die vindbaar én schaalbaar zijn',
    metaTitle: 'Website of app laten bouwen | MNRV',
    metaDescription: 'MNRV ontwerpt en bouwt snelle, toegankelijke websites en webapps met sterke UX, technische SEO, AI-integraties en een schaalbare architectuur.',
    card: 'Conversiegerichte websites en webapps met een solide technische basis, sterke UX en ruimte voor AI.',
    lead: 'Een digitaal product moet snel laden, logisch werken en gevonden worden. We brengen strategie, UX, development, technische SEO en AI samen in één schaalbare oplossing.',
    summaryHeading: 'Van eerste klik tot werkend systeem',
    summary: [
      'We bouwen geen los ontwerp dat later technisch passend wordt gemaakt. Informatiearchitectuur, content, interactie, performance, toegankelijkheid en beheer worden vanaf het begin als één systeem ontworpen.',
      'Dat levert een website of applicatie op die voor bezoekers helder is, voor beheerders werkbaar blijft en voor zoekmachines en AI-systemen technisch te begrijpen is.'
    ],
    audience: 'Organisaties die een nieuwe website, klantportal, configurator of webapp nodig hebben.',
    result: 'Een snel en onderhoudbaar platform met duidelijke gebruikersroutes en meetbare conversiepunten.',
    collaboration: 'Strategie, ontwerp, bouw, contentstructuur, lancering en doorontwikkeling.',
    tags: ['UX-strategie', 'Webdevelopment', 'Core Web Vitals', 'Technische SEO', 'AI-integratie'],
    deliverables: [
      ['Informatiearchitectuur', 'Een logische paginastructuur, navigatie en interne linkarchitectuur rond gebruikersdoelen en zoekintentie.'],
      ['UX & interface design', 'Responsive schermen, toegankelijke interacties en consistente componenten die vertrouwen en overzicht creëren.'],
      ['Frontend & backend', 'Een technische architectuur die past bij het product, het beheer en de verwachte groei.'],
      ['Performance', 'Optimalisatie van afbeeldingen, fonts, scripts en rendering met Core Web Vitals als kwaliteitskader.'],
      ['SEO-fundament', 'Metadata, canonicals, structured data, semantische HTML, sitemaps en crawlbare interne links.'],
      ['AI in de ervaring', 'Zoeken, assistenten, aanbevelingen of automatisering waar dit aantoonbaar waarde toevoegt.']
    ],
    steps: [
      ['Inventarisatie', 'We brengen doelen, gebruikers, content, systemen, risico’s en succescriteria samen.'],
      ['Architectuur & ontwerp', 'We bepalen de technische opzet, informatiehiërarchie en belangrijkste gebruikersroutes.'],
      ['Bouw & integratie', 'We ontwikkelen iteratief, koppelen benodigde systemen en bewaken toegankelijkheid en performance.'],
      ['Lancering & verbetering', 'We controleren indexeerbaarheid, analytics, formulieren en kernflows en verbeteren op basis van gebruik.']
    ],
    expertise: ['HTML5', 'CSS', 'JavaScript', 'React', 'Next.js', 'API-koppelingen', 'WCAG', 'Schema.org', 'GA4', 'Search Console'],
    faq: [
      ['Bouwen jullie zowel websites als webapps?', 'Ja. We bouwen publieke websites, marketingplatformen, klantportalen, configurators en webapplicaties. De stack volgt uit de functionele en beheerbehoefte.'],
      ['Kunnen jullie een bestaande website vernieuwen zonder SEO-verlies?', 'Ja. We inventariseren bestaande URL’s, metadata, interne links en organisch verkeer. Bij gewijzigde URL’s maken we een redirectplan en controleren we canonicals en sitemap voor de lancering.'],
      ['Is het ontwerp ook geschikt voor mobiel en toegankelijk gebruik?', 'Ja. Responsive gedrag, toetsenbordbediening, contrast, semantiek en duidelijke focusstates zijn onderdeel van ontwerp en QA.'],
      ['Kunnen AI-functies later worden toegevoegd?', 'Ja. We leggen data-, API- en componentgrenzen zo aan dat een assistent, semantische zoekfunctie of automatisering later gecontroleerd kan worden toegevoegd.']
    ],
    related: ['seo-ai-vindbaarheid', 'maatwerk-integraties', 'agentic-ai']
  },
  {
    number: '02',
    slug: 'agentic-ai',
    navTitle: 'Agentic AI',
    title: 'Agentic AI & autonome assistenten',
    metaTitle: 'AI-agent en autonome assistent bouwen | MNRV',
    metaDescription: 'MNRV bouwt AI-agenten en autonome assistenten met toolgebruik, guardrails, observability, human-in-the-loop en veilige systeemintegraties.',
    card: 'AI-agenten die niet alleen antwoorden geven, maar gecontroleerd taken uitvoeren binnen bestaande processen.',
    lead: 'Van chatbot naar handelende assistent. We ontwerpen AI-agenten die informatie ophalen, tools gebruiken en taken afronden binnen duidelijke bevoegdheden en controlepunten.',
    summaryHeading: 'Autonomie met controle',
    summary: [
      'Een betrouwbare AI-agent bestaat uit meer dan een taalmodel en een prompt. Identiteit, context, tools, rechten, evaluaties, logging en foutafhandeling bepalen of een agent veilig in de dagelijkse operatie kan werken.',
      'We ontwerpen die volledige agentic stack: van use-case en toolcontract tot human-in-the-loop, observability en een beheerbare productervaring.'
    ],
    audience: 'Teams met repeterende kennis- of processtappen die deels geautomatiseerd kunnen worden.',
    result: 'Een begrensde AI-assistent die taken uitvoert, keuzes uitlegt en tijdig om menselijke beoordeling vraagt.',
    collaboration: 'Use-case selectie, prototype, evaluaties, integraties, governance en productiebeheer.',
    tags: ['AI agents', 'Tool use', 'Guardrails', 'Evaluations', 'Human-in-the-loop'],
    deliverables: [
      ['Agentarchitectuur', 'Rollen, instructies, geheugen, contextvensters en beslisgrenzen afgestemd op de taak.'],
      ['Toolcontracten', 'Veilige functies voor CRM, agenda, kennisbank, e-mail, planning of interne API’s.'],
      ['Retrieval & grounding', 'RAG, bronverwijzing en contextselectie om antwoorden en acties op betrouwbare data te baseren.'],
      ['Guardrails', 'Autorisatie, validatie, rate limits, privacyregels en expliciete bevestiging bij risicovolle acties.'],
      ['Evaluaties', 'Testsets en scenario’s voor taakresultaat, juistheid, robuustheid, latency en kosten.'],
      ['Observability', 'Logging, traces, feedback en foutanalyse waarmee gedrag beheersbaar blijft na lancering.']
    ],
    steps: [
      ['Taakselectie', 'We kiezen een afgebakend proces met duidelijke input, bevoegdheden en een meetbaar resultaat.'],
      ['Prototype & evaluatie', 'We bouwen de kleinste werkende agent en testen deze op echte scenario’s en uitzonderingen.'],
      ['Integratie & governance', 'We koppelen tools, regelen toegangsrechten en definiëren menselijke controlepunten.'],
      ['Productie & monitoring', 'We lanceren gecontroleerd, volgen prestaties en verbeteren prompts, tools en evaluaties.']
    ],
    expertise: ['LLM orchestration', 'RAG', 'Function calling', 'MCP', 'Vector search', 'Prompt engineering', 'Evals', 'Tracing', 'PII-controls', 'Voice AI'],
    faq: [
      ['Wat is het verschil tussen een chatbot en een AI-agent?', 'Een chatbot beantwoordt vooral vragen. Een agent kan binnen vastgelegde rechten ook tools gebruiken, gegevens ophalen, stappen plannen en een taak uitvoeren.'],
      ['Kan een agent zelfstandig beslissingen nemen?', 'Alleen binnen expliciet vastgelegde grenzen. Voor gevoelige, financiële of onomkeerbare acties ontwerpen we bevestiging, escalatie en menselijke controle.'],
      ['Hoe voorkomen jullie hallucinaties?', 'We beperken open context, gebruiken betrouwbare bronnen, valideren toolinput en output en testen met vaste evaluaties. Volledige foutloosheid is niet realistisch; beheersbaarheid wel.'],
      ['Kunnen jullie een agent koppelen aan onze bestaande systemen?', 'Ja, als die systemen een geschikte API, database-interface of gecontroleerde automatiseringslaag bieden. We beoordelen eerst rechten, datakwaliteit en foutscenario’s.']
    ],
    related: ['kennisinfrastructuur', 'maatwerk-integraties', 'workforce-automation']
  },
  {
    number: '03',
    slug: 'maatwerk-integraties',
    navTitle: 'Maatwerk & integraties',
    title: 'Maatwerk software & systeemintegraties',
    metaTitle: 'Maatwerk software en API-integraties | MNRV',
    metaDescription: 'MNRV bouwt maatwerksoftware, API-koppelingen en integratielagen die data, processen, teams en AI-agenten betrouwbaar met elkaar verbinden.',
    card: 'Maatwerksoftware en integraties die losse systemen veranderen in één betrouwbare operationele keten.',
    lead: 'Wanneer standaardsoftware niet genoeg samenwerkt, ontwerpen we de ontbrekende laag: maatwerktools, API-koppelingen en automatiseringen die data en processen verbinden.',
    summaryHeading: 'Eén keten, duidelijke verantwoordelijkheden',
    summary: [
      'Integraties falen zelden door één API-call. Datamodellen, autorisatie, retries, idempotency, monitoring en eigenaarschap bepalen of een koppeling in de praktijk betrouwbaar blijft.',
      'We ontwerpen de integratielaag rondom het werkproces. Zo ontstaat geen verzameling scripts, maar een onderhoudbaar systeem met zichtbare status en gecontroleerde foutafhandeling.'
    ],
    audience: 'Organisaties met versnipperde data, handmatige overdrachten of ontbrekende functionaliteit tussen systemen.',
    result: 'Minder dubbele invoer, snellere processen en één controleerbare datastroom.',
    collaboration: 'Procesanalyse, datamapping, architectuur, bouw, migratie en beheerinrichting.',
    tags: ['API-integratie', 'Maatwerksoftware', 'Webhooks', 'Datamigratie', 'Automation'],
    deliverables: [
      ['Proces- en datamapping', 'Een concreet overzicht van bronnen, velden, triggers, uitzonderingen en systeemeigenaarschap.'],
      ['API-koppelingen', 'Beveiligde REST-, GraphQL- of webhookintegraties met duidelijke contracten en validatie.'],
      ['Interne tools', 'Portalen en dashboards voor taken die niet goed in bestaande software passen.'],
      ['Workflow automation', 'Gebeurtenisgestuurde processen met retries, statusbeheer en menselijke uitzonderingsroutes.'],
      ['Datamigratie', 'Gecontroleerde extractie, opschoning, mapping, proefruns en reconciliatie.'],
      ['Monitoring', 'Logs, alerts en operationele dashboards waarmee fouten zichtbaar en herstelbaar worden.']
    ],
    steps: [
      ['Ketenanalyse', 'We volgen data en werk van bron tot eindresultaat en markeren risico’s en handmatige overdrachten.'],
      ['Contract & architectuur', 'We leggen datamodellen, API-contracten, autorisatie en foutgedrag vast.'],
      ['Bouw & proefrun', 'We ontwikkelen per integratiestap en testen met representatieve data en storingsscenario’s.'],
      ['Ingebruikname', 'We migreren gecontroleerd, monitoren de eerste runs en documenteren beheer en herstel.']
    ],
    expertise: ['REST', 'GraphQL', 'Webhooks', 'OAuth', 'ETL', 'PostgreSQL', 'Supabase', 'Firebase', 'Microsoft Graph', 'Power Automate'],
    faq: [
      ['Wanneer is maatwerk beter dan een standaardkoppeling?', 'Als het proces onderscheidend is, standaardconnectors belangrijke uitzonderingen missen of betrouwbaarheid en beheer aantoonbaar meer controle vragen.'],
      ['Kunnen jullie ook oude data migreren?', 'Ja. We maken mappings, valideren brondata, draaien proefmigraties en vergelijken aantallen en sleutelvelden vóór de definitieve overgang.'],
      ['Wat gebeurt er als een gekoppeld systeem uitvalt?', 'We ontwerpen retries, foutstatussen en alerts. Waar nodig bewaren we gebeurtenissen tijdelijk zodat verwerking later gecontroleerd kan worden hervat.'],
      ['Documenteren jullie de integraties?', 'Ja. We documenteren datastromen, contracten, toegangsrechten, foutcodes en beheerstappen zodat de oplossing overdraagbaar blijft.']
    ],
    related: ['websites-apps', 'ecommerce-wordpress-shopify', 'agentic-ai']
  },
  {
    number: '04',
    slug: 'workforce-automation',
    navTitle: 'Workforce automation',
    title: 'Workforce automation & slimme planning',
    metaTitle: 'Workforce automation en planningstool | MNRV',
    metaDescription: 'MNRV bouwt workforce automation voor capaciteit, skills-based planning, forecasting, taakverdeling en operationele sturing met menselijke controle.',
    card: 'Planning, capaciteit en taakverdeling verbonden in een operationeel systeem dat teams echt ondersteunt.',
    lead: 'Van losse spreadsheets naar een samenhangende planningsketen. We bouwen tools voor capaciteit, beschikbaarheid, skills, forecasting en dagelijkse bijsturing.',
    summaryHeading: 'Automatiseren zonder de operatie plat te slaan',
    summary: [
      'Een planning is geen tabel, maar een set van afspraken, uitzonderingen en belangen. Beschikbaarheid, kwalificaties, contractregels, vraagpatronen en lokale werkwijzen moeten allemaal samenkomen.',
      'We vertalen die werkelijkheid naar een beheersbaar model. Automatisering doet het repetitieve rekenwerk; planners en teamleiders houden controle over uitzonderingen en uiteindelijke keuzes.'
    ],
    audience: 'Operationele organisaties met meerdere teams, locaties, diensten, skills of fluctuerende capaciteitsvraag.',
    result: 'Meer inzicht in bezetting en knelpunten, minder handwerk en beter onderbouwde planningsbeslissingen.',
    collaboration: 'Processtandaardisatie, datamodel, planner-UX, automatisering, pilot en gefaseerde invoering.',
    tags: ['Capacity planning', 'Forecasting', 'Skills matching', 'Scheduling', 'Operational analytics'],
    deliverables: [
      ['Capaciteitsmodel', 'Vraag, aanbod, contracturen en productiviteit vertaald naar een controleerbaar planningsmodel.'],
      ['Skills-based matching', 'Toewijzing op basis van kwalificaties, ervaring, beschikbaarheid en lokale regels.'],
      ['Forecasting', 'Scenario’s en prognoses waarmee teams toekomstige onder- en overbezetting eerder zien.'],
      ['Planner workspace', 'Een snelle interface voor publiceren, verschuiven, vergelijken en afhandelen van uitzonderingen.'],
      ['Medewerkerflow', 'Beschikbaarheid, voorkeuren, ruilverzoeken en notificaties in een duidelijke selfservice-ervaring.'],
      ['Operationele dashboards', 'Sturing op bezetting, open diensten, workload, afwijkingen en datakwaliteit.']
    ],
    steps: [
      ['Procesnormalisatie', 'We onderscheiden vaste regels, lokale varianten en uitzonderingen voordat we automatiseren.'],
      ['Datamodel & prototype', 'We modelleren diensten, skills, beschikbaarheid en vraag en testen de kernflow met planners.'],
      ['Pilot', 'We starten met een afgebakend team of locatie en vergelijken uitkomsten met de bestaande werkwijze.'],
      ['Gefaseerde uitrol', 'We breiden uit met meetpunten, beheerrollen, training en duidelijke rollbackscenario’s.']
    ],
    expertise: ['Roster modelling', 'Constraint logic', 'Forecasting', 'Skills taxonomy', 'Role-based access', 'Scenario planning', 'Dashboards', 'Audit trails'],
    faq: [
      ['Vervangt workforce automation de planner?', 'Nee. Het systeem automatiseert berekeningen en repeterende handelingen. De planner bewaakt context, uitzonderingen en keuzes met impact op mensen.'],
      ['Kunnen lokale teams eigen regels behouden?', 'Ja, zolang duidelijk is welke regels centraal en welke lokaal zijn. We modelleren varianten expliciet zodat ze beheersbaar blijven.'],
      ['Kunnen jullie bestaande Excel-planningen migreren?', 'Ja. We gebruiken ze als bron voor proces- en datamapping, maar bouwen geen één-op-één kopie van onduidelijke of tegenstrijdige logica.'],
      ['Hoe gaan jullie om met privacy?', 'We beperken persoonsgegevens tot wat voor planning nodig is, werken met rollen en logging en stemmen bewaartermijnen en toegang af op het proces.']
    ],
    related: ['maatwerk-integraties', 'agentic-ai', 'kennisinfrastructuur']
  },
  {
    number: '05',
    slug: 'reputatie-intelligentie',
    navTitle: 'Reputatie-intelligentie',
    title: 'Reputatie-intelligentie & review automation',
    metaTitle: 'Reputatie-intelligentie en review automation | MNRV',
    metaDescription: 'MNRV bouwt review- en reputatiesystemen voor monitoring, sentiment, routing, opvolging en inzicht in hoe zoekmachines en AI-systemen je merk beschrijven.',
    card: 'Reviews, sentiment en merkvermeldingen samengebracht tot signalen waarop teams gericht kunnen handelen.',
    lead: 'Reputatie ontstaat op reviewplatformen, in zoekresultaten en in AI-antwoorden. We bouwen systemen die signalen verzamelen, duiden en naar de juiste opvolging routeren.',
    summaryHeading: 'Van losse melding naar bruikbare context',
    summary: [
      'Een sterrenscore vertelt niet waarom klanten afhaken, welke locatie structureel afwijkt of welk onderwerp reputatierisico veroorzaakt. Daarvoor moeten bronnen, thema’s, sentiment en operationele context samenkomen.',
      'We ontwerpen een reputatielaag die teams helpt prioriteren. Niet elke negatieve review is urgent en niet elk positief patroon is vanzelf zichtbaar.'
    ],
    audience: 'Merken met meerdere locaties, veel klantcontact of verspreide review- en feedbackbronnen.',
    result: 'Snellere opvolging, zichtbare patronen en beter onderbouwde verbeteracties.',
    collaboration: 'Broninventarisatie, datamodel, classificatie, workflows, dashboards en meetkader.',
    tags: ['Review management', 'Sentiment analysis', 'Entity monitoring', 'AI visibility', 'Workflow routing'],
    deliverables: [
      ['Bronkoppelingen', 'Reviews en feedback uit relevante platformen en interne kanalen in één datastroom.'],
      ['Classificatie', 'Thema, sentiment, urgentie, locatie en product automatisch of semi-automatisch labelen.'],
      ['Opvolgflows', 'Taken, conceptreacties en escalaties naar het team dat daadwerkelijk kan handelen.'],
      ['Trenddetectie', 'Terugkerende onderwerpen en afwijkingen zichtbaar maken vóór ze breed escaleren.'],
      ['Merk- en entiteitsmonitoring', 'Controleren hoe merk, aanbod en kernfeiten terugkomen in zoek- en AI-ervaringen.'],
      ['Managementrapportage', 'KPI’s met context: volume, responstijd, thema’s, locaties en gerealiseerde verbeteracties.']
    ],
    steps: [
      ['Bronnen & doelen', 'We bepalen welke feedbackbronnen relevant zijn en welke beslissingen het systeem moet ondersteunen.'],
      ['Taxonomie', 'We definiëren thema’s, urgentie, locaties en gewenste routes met voorbeelden uit de praktijk.'],
      ['Automatisering', 'We koppelen bronnen, classificeren signalen en bouwen opvolg- en escalatieflows.'],
      ['Kalibratie', 'We vergelijken automatische labels met menselijke beoordeling en verfijnen de regels en modellen.']
    ],
    expertise: ['Review APIs', 'Sentiment', 'Topic classification', 'Entity consistency', 'Alerting', 'Response workflows', 'Dashboards', 'Audit logging'],
    faq: [
      ['Schrijven jullie automatisch antwoorden op reviews?', 'Dat kan, maar publicatie hoort bij voorkeur onder menselijke controle. We kunnen concepten genereren op basis van beleid, context en tone of voice.'],
      ['Kunnen meerdere locaties apart worden gevolgd?', 'Ja. We modelleren locaties, teams, producten en kanalen zodat verschillen en terugkerende oorzaken zichtbaar worden.'],
      ['Wat bedoelen jullie met AI-reputatie?', 'Dat is de manier waarop generatieve zoek- en antwoordsystemen je merk, aanbod en kernfeiten samenvatten. We volgen dit als aanvullend signaal, niet als volledig meetbare waarheid.'],
      ['Is sentimentanalyse altijd betrouwbaar?', 'Nee. Ironie, context en taalvariatie blijven lastig. Daarom gebruiken we confidence scores, steekproeven en menselijke correctie voor belangrijke beslissingen.']
    ],
    related: ['seo-ai-vindbaarheid', 'kennisinfrastructuur', 'agentic-ai']
  },
  {
    number: '06',
    slug: 'kennisinfrastructuur',
    navTitle: 'Kennisinfrastructuur',
    title: 'Kennisinfrastructuur voor mens en AI',
    metaTitle: 'Kennisbank, RAG en kennisinfrastructuur | MNRV',
    metaDescription: 'MNRV bouwt governed kennisbanken, semantische zoeklagen, knowledge graphs en RAG-infrastructuur voor medewerkers, klanten en AI-agenten.',
    card: 'Een betrouwbare kennislaag waarin medewerkers, klanten en AI-agenten dezelfde actuele bron gebruiken.',
    lead: 'We maken verspreide documenten, processen en expertise vindbaar, beheersbaar en activeerbaar voor mensen én AI-systemen.',
    summaryHeading: 'Van documentenverzameling naar bron van waarheid',
    summary: [
      'Kennis raakt versnipperd over mappen, chats, mailboxen en hoofden. Een zoekveld bovenop die bronnen lost veroudering, tegenspraak en onduidelijk eigenaarschap niet op.',
      'We ontwerpen een kennisinfrastructuur met bronbeheer, taxonomie, metadata, toegangsrechten en retrieval. Daardoor kan dezelfde gevalideerde kennis worden gebruikt in een portal, zoekfunctie, assistent of agent.'
    ],
    audience: 'Organisaties met veel procedures, productkennis, klantvragen of expertise verspreid over meerdere systemen.',
    result: 'Sneller betrouwbare informatie vinden en een controleerbare basis voor AI-toepassingen.',
    collaboration: 'Kennisinventarisatie, governance, informatiearchitectuur, retrieval, interface en adoptie.',
    tags: ['Knowledge management', 'RAG', 'Semantic search', 'Knowledge graph', 'Governance'],
    deliverables: [
      ['Broninventarisatie', 'Inzicht in documenten, systemen, eigenaarschap, actualiteit en toegangsrechten.'],
      ['Taxonomie & metadata', 'Een begrippenstructuur waarmee kennis consistent wordt geclassificeerd en teruggevonden.'],
      ['Redactie- en reviewflow', 'Duidelijke status, eigenaar, revisiedatum en goedkeuring voor kritieke kennis.'],
      ['Semantische retrieval', 'Zoeken op betekenis met filters, bronverwijzing en toegangscontrole.'],
      ['RAG-laag', 'Gecontroleerde contextselectie voor assistenten en agenten, inclusief citaties en evaluaties.'],
      ['Kenniservaring', 'Een toegankelijke interface voor zoeken, navigeren, bijdragen en feedback geven.']
    ],
    steps: [
      ['Kennislandschap', 'We brengen bronnen, gebruikersvragen, risico’s en eigenaarschap in kaart.'],
      ['Model & governance', 'We ontwerpen taxonomie, metadata, rollen, revisies en publicatiestatussen.'],
      ['Retrieval & ervaring', 'We bouwen zoek- en navigatieflows en testen relevantie op echte vragen.'],
      ['AI-activatie', 'We koppelen gevalideerde kennis aan assistenten of agents met bronverwijzing en evaluaties.']
    ],
    expertise: ['RAG', 'Embeddings', 'Vector databases', 'Knowledge graphs', 'Taxonomy', 'Metadata', 'Access control', 'Content lifecycle', 'Evals'],
    faq: [
      ['Is een kennisbank hetzelfde als een map met documenten?', 'Nee. Een kennisbank voegt structuur, eigenaarschap, actualiteit, zoekbaarheid en gebruikscontext toe. Documenten kunnen een bron zijn, maar zijn niet het eindmodel.'],
      ['Kunnen bestaande SharePoint- of Drive-documenten worden gebruikt?', 'Ja. We kunnen bronnen ontsluiten of migreren, afhankelijk van kwaliteit, rechten en beheer. Niet alle documenten hoeven fysiek te worden verplaatst.'],
      ['Hoe weet een AI-assistent welke bron betrouwbaar is?', 'We gebruiken status, eigenaarschap, metadata, rechten en retrievalregels. Antwoorden tonen waar mogelijk de gebruikte bron zodat gebruikers kunnen controleren.'],
      ['Hoe blijft de kennis actueel?', 'Met expliciete eigenaren, revisiedata, reviewflows, feedback en signalen voor verouderde of conflicterende inhoud.']
    ],
    related: ['agentic-ai', 'seo-ai-vindbaarheid', 'maatwerk-integraties']
  },
  {
    number: '07',
    slug: 'ecommerce-wordpress-shopify',
    navTitle: 'E-commerce & platforms',
    title: 'E-commerce, WordPress & Shopify',
    metaTitle: 'E-commerce, WordPress en Shopify bureau | MNRV',
    metaDescription: 'MNRV bouwt en migreert WordPress-, WooCommerce- en Shopify-platformen met maatwerk, AI-integraties, technische SEO en betrouwbare commerce-koppelingen.',
    card: 'Bouw en migratie van WordPress, WooCommerce en Shopify met maatwerk, integraties, AI en technische SEO.',
    lead: 'We bouwen en migreren commerceplatformen die productdata, content, checkout, operations en marketing verbinden — op WordPress, WooCommerce, Shopify of een passende headless architectuur.',
    summaryHeading: 'Het platform volgt de operatie',
    summary: [
      'De juiste keuze is niet automatisch WordPress of Shopify. Assortiment, contentteam, checkout, internationale groei, integraties, ownership en beheer bepalen welk platform het beste past.',
      'We begeleiden de volledige keten: selectie, informatiearchitectuur, design, bouw, catalogusmigratie, redirectplan, integraties, tracking en gecontroleerde livegang.'
    ],
    audience: 'Merken die een webshop starten, herplatformen of een verouderde WordPress-, WooCommerce- of Shopify-omgeving willen vervangen.',
    result: 'Een beheersbaar commerceplatform met betrouwbare productdata, snelle klantreizen en behoud van organische waarde.',
    collaboration: 'Platformselectie, UX, bouw, datamigratie, integraties, SEO-migratie en optimalisatie.',
    tags: ['Shopify', 'WordPress', 'WooCommerce', 'Headless commerce', 'AI commerce'],
    deliverables: [
      ['Platformselectie', 'Een onderbouwde keuze tussen Shopify, WordPress/WooCommerce, headless of maatwerk op basis van processen en groei.'],
      ['Storefront & checkout', 'Responsive categorie-, product-, zoek-, winkelwagen- en checkoutflows met duidelijke koopinformatie.'],
      ['Catalogusmigratie', 'Producten, varianten, media, categorieën, klanten en content gecontroleerd mappen en importeren.'],
      ['SEO-migratie', 'URL-inventarisatie, 301-redirects, canonicals, metadata, structured data en sitemap vóór livegang.'],
      ['Commerce-integraties', 'Koppelingen met ERP, PIM, voorraad, fulfilment, betalingen, CRM, e-mail en analytics.'],
      ['AI-integratie', 'Semantisch zoeken, productassistenten, contentondersteuning en serviceflows met guardrails en productdata als bron.']
    ],
    steps: [
      ['Commerce-audit', 'We analyseren assortiment, content, conversie, techniek, integraties en organische landingspagina’s.'],
      ['Platform & migratieplan', 'We kiezen de architectuur en leggen data, redirects, tracking en overgangsmomenten vast.'],
      ['Bouw & proefmigratie', 'We ontwikkelen de storefront en draaien herhaalbare imports met inhoudelijke controles.'],
      ['Livegang & stabilisatie', 'We controleren checkout, betalingen, tracking, indexeerbaarheid, redirects en operationele overdracht.']
    ],
    expertise: ['Shopify', 'Shopify APIs', 'WordPress', 'WooCommerce', 'Headless commerce', 'PIM', 'ERP', 'Mollie', 'Product schema', 'Merchant feeds'],
    faq: [
      ['Wanneer kies ik Shopify en wanneer WooCommerce?', 'Shopify biedt een sterk beheerd commerceplatform en voorspelbaar technisch beheer. WooCommerce geeft meer vrijheid binnen WordPress. De beste keuze hangt af van content, integraties, ownership en gewenste maatwerkruimte.'],
      ['Kunnen jullie migreren zonder organisch verkeer onnodig te verliezen?', 'We inventariseren indexeerbare URL’s en backlinks, behouden waardevolle structuren waar mogelijk en maken een getest 301-redirectplan. Na livegang controleren we crawl- en indexeringssignalen.'],
      ['Bouwen jullie ook headless Shopify of headless WordPress?', 'Ja, wanneer performance, meerdere kanalen of een afwijkende frontend dat rechtvaardigen. We adviseren dit niet als de extra complexiteit geen aantoonbare waarde oplevert.'],
      ['Welke AI-functies zijn bruikbaar voor een webshop?', 'Voorbeelden zijn semantisch zoeken, productadvies, klantenservice, catalogusverrijking en interne contentondersteuning. We koppelen deze functies aan actuele productdata en duidelijke guardrails.']
    ],
    related: ['seo-ai-vindbaarheid', 'maatwerk-integraties', 'websites-apps']
  },
  {
    number: '08',
    slug: 'seo-ai-vindbaarheid',
    navTitle: 'SEO & AI-vindbaarheid',
    title: 'SEO, GEO & AI-vindbaarheid',
    metaTitle: 'Technische SEO, GEO en AI-vindbaarheid | MNRV',
    metaDescription: 'MNRV verbetert technische SEO en AI-vindbaarheid met crawlbaarheid, entity SEO, structured data, information gain, AEO, GEO, LLMO en meetbare contentarchitectuur.',
    card: 'Technische SEO, entity SEO en contentarchitectuur voor klassieke zoekresultaten én generatieve zoekervaringen.',
    lead: 'We combineren technical SEO, entity SEO, AEO, GEO en LLMO tot één praktisch programma voor crawlbaarheid, indexeerbaarheid, topical authority en zichtbaarheid in generatieve zoekervaringen.',
    summaryHeading: 'Geen aparte truc voor AI, wel een beter informatiesysteem',
    summary: [
      'GEO, AEO en LLMO zijn bruikbare markttermen, maar geen magische rankinglaag. De basis blijft: indexeerbare pagina’s, duidelijke entiteiten, sterke interne links, unieke informatie, actuele feiten en structured data die overeenkomt met zichtbare content.',
      'We vertalen dat naar een meetbare architectuur voor klassieke zoekmachines, AI Overviews, AI Mode en andere generatieve answer engines — zonder keyword stuffing of niet-onderbouwde zichtbaarheidsgaranties.'
    ],
    audience: 'Organisaties die organische groei, technische vindbaarheid en merkzichtbaarheid in generatieve zoekervaringen structureel willen verbeteren.',
    result: 'Een crawlbare site, duidelijke thematische autoriteit en content die mensen én retrievalsystemen goed kunnen interpreteren.',
    collaboration: 'Technische audit, entiteitsmodel, contentstrategie, implementatie, monitoring en iteratie.',
    tags: ['Technical SEO', 'GEO', 'AEO', 'LLMO', 'Entity SEO', 'Structured data'],
    deliverables: [
      ['Technical SEO audit', 'Indexability, rendering, statuscodes, canonicals, robots, sitemaps, Core Web Vitals en crawlbare interne links.'],
      ['Entity SEO', 'Een consistent model voor merk, diensten, experts, locaties, producten en relaties tussen pagina’s.'],
      ['Topical architecture', 'Pillar pages, ondersteunende content en interne linkgraphs rond zoekintentie en beslisvragen.'],
      ['Structured data', 'JSON-LD voor Organization, Service, BreadcrumbList, Product of andere typen die zichtbaar worden ondersteund.'],
      ['GEO/AEO-content', 'Antwoordgerichte secties, information gain, bronwaardige feiten, heldere definities en citeerbare passages.'],
      ['AI visibility monitoring', 'Een vaste promptset en observatiemodel voor merkvermeldingen, brongebruik, factual consistency en verandering door de tijd.']
    ],
    steps: [
      ['Crawl & index-audit', 'We meten technische toegankelijkheid, URL-signalen, templates, interne links en performance.'],
      ['Entiteiten & zoekintentie', 'We koppelen diensten, expertise en klantvragen aan een heldere content- en URL-architectuur.'],
      ['Implementatie', 'We verbeteren templates, metadata, schema, contentstructuur, interne links en sitemap.'],
      ['Meting & iteratie', 'We volgen Search Console, analytics, rankings, conversie en een reproduceerbare AI-visibility promptset.']
    ],
    expertise: ['Crawlability', 'Indexability', 'Canonicalization', 'Core Web Vitals', 'Schema.org', 'JSON-LD', 'Entity SEO', 'Topical authority', 'AEO', 'GEO', 'LLMO', 'RAG readiness'],
    faq: [
      ['Wat betekenen GEO, AEO en LLMO?', 'GEO staat voor Generative Engine Optimization, AEO voor Answer Engine Optimization en LLMO voor Large Language Model Optimization. Het zijn markttermen voor content en techniek die vindbaarheid in antwoord- en generatieve systemen ondersteunen.'],
      ['Is er speciale structured data voor AI Overviews?', 'Nee. Er is geen speciaal AI-schema nodig. Structured data moet een ondersteund type gebruiken en overeenkomen met de zichtbare pagina-inhoud.'],
      ['Heb ik een llms.txt-bestand nodig voor Google?', 'Nee. Google geeft aan dat llms.txt niet nodig is voor zichtbaarheid in Google Search of de generatieve functies daarvan. Crawlbare, indexeerbare en nuttige webcontent blijft de basis.'],
      ['Kunnen jullie garanderen dat ChatGPT of Google mijn merk noemt?', 'Nee. Geen bureau kan opname of ranking in generatieve antwoorden garanderen. We kunnen wel de technische toegankelijkheid, entiteitsconsistentie, informatiekwaliteit en meetbaarheid aantoonbaar verbeteren.']
    ],
    related: ['websites-apps', 'ecommerce-wordpress-shopify', 'kennisinfrastructuur'],
    sourceNote: 'Onze aanpak volgt de technische basis van Google Search en gebruikt GEO, AEO en LLMO als werktermen, niet als officiële rankingfactoren.'
  }
];

const serviceBySlug = new Map(services.map((service) => [service.slug, service]));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function jsonLd(value) {
  return JSON.stringify(value, null, 2).replaceAll('<', '\\u003c');
}

function analyticsHead() {
  return `
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      functionality_storage: 'denied',
      security_storage: 'granted',
      wait_for_update: 500
    });
    gtag('set', { ads_data_redaction: true });
  </script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-LTWVDY8K85"></script>
  <script>
    gtag('js', new Date());
    gtag('config', 'G-LTWVDY8K85');
  </script>`;
}

function navigation() {
  return `
  <a class="skip-link" href="#main-content">Ga naar de hoofdinhoud</a>
  <nav class="site-nav" aria-label="Hoofdnavigatie">
    <a class="site-nav__logo" href="/assets/mnrv.html" aria-label="MNRV moderne site">
      <img src="/assets/img/MNRV_LOGO.png" alt="MNRV" width="58" height="58">
    </a>
    <div class="site-nav__links">
      <a href="/diensten/">Diensten</a>
      <a href="/assets/mnrv.html#ontdek">Werk</a>
      <a href="/assets/mnrv.html#over">Over MNRV</a>
    </div>
    <a class="site-nav__cta" href="/assets/mnrv.html#contact">Start een project</a>
  </nav>`;
}

function footer() {
  const serviceLinks = services
    .map((service) => `<li><a href="/diensten/${service.slug}/">${escapeHtml(service.navTitle)}</a></li>`)
    .join('\n            ');

  return `
  <footer class="site-footer">
    <div class="site-footer__inner">
      <div class="footer-brand">
        <img src="/assets/img/MNRV_LOGO.png" alt="MNRV" width="76" height="76" loading="lazy">
        <p>MNRV verbindt strategie, operations, design, development en AI. We bouwen websites, commerceplatformen, software-integraties en AI-systemen die aantoonbaar werk uit handen nemen.</p>
      </div>
      <nav class="footer-column" aria-label="Diensten">
        <h2>Diensten</h2>
        <ul>
            ${serviceLinks}
        </ul>
      </nav>
      <nav class="footer-column" aria-label="MNRV">
        <h2>MNRV</h2>
        <ul>
          <li><a href="/assets/mnrv.html">Moderne site</a></li>
          <li><a href="/assets/mnrv.html#ontdek">Uitgelicht werk</a></li>
          <li><a href="/assets/mnrv.html#over">Over MNRV</a></li>
          <li><a href="/portfolio.html">Portfolio</a></li>
          <li><a href="/contact.html">Contact</a></li>
        </ul>
      </nav>
      <div class="footer-column">
        <h2>Contact</h2>
        <ul>
          <li><a href="mailto:info@mnrv.nl">info@mnrv.nl</a></li>
          <li><a href="tel:+31682456410">+31 6 82 45 64 10</a></li>
          <li><a href="https://wa.me/31682456410" rel="noopener">WhatsApp</a></li>
          <li><a href="https://www.linkedin.com/in/davevera/" rel="noopener">LinkedIn</a></li>
          <li><a href="https://www.instagram.com/mnrv.ai/" rel="noopener">Instagram</a></li>
        </ul>
      </div>
      <div class="footer-bottom">
        <span>© 2026 MNRV / Dave Vera — mnrv.nl</span>
        <div class="footer-bottom__links">
          <a href="/assets/Documenten/MNRV_Privacyverklaring_12-06-2026.pdf">Privacy</a>
          <a href="/assets/Documenten/MNRV_Cookieverklaring_12-06-2026.pdf">Cookies</a>
          <a href="/assets/Documenten/MNRV_Algemene_Voorwaarden_12-06-2026.pdf">Algemene voorwaarden</a>
          <a href="/assets/Documenten/MNRV_Verwerkersovereenkomst_12-06-2026.pdf">Verwerkersovereenkomst</a>
          <a href="/assets/Documenten/MNRV_SLA_06-2026.pdf">SLA</a>
        </div>
      </div>
    </div>
  </footer>
  <script src="/components/cookie-banner.js" defer></script>`;
}

function documentHead({ title, description, canonical, schema }) {
  return `<!DOCTYPE html>
<html lang="nl" class="mnrv-modern">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="nl_NL">
  <meta property="og:site_name" content="MNRV">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${siteUrl}/assets/img/MNRV_LOGO.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${siteUrl}/assets/img/MNRV_LOGO.png">
  <link rel="icon" type="image/png" href="/assets/img/MNRV_LOGO.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&amp;family=Roboto:wght@300;400;500&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/diensten/service-pages.css">
  <link rel="stylesheet" href="/components/cookie-banner.css">
${analyticsHead()}
  <script type="application/ld+json">
${jsonLd(schema)}
  </script>
</head>`;
}

function serviceSchema(service) {
  const canonical = `${siteUrl}/diensten/${service.slug}/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'MNRV', item: `${siteUrl}/assets/mnrv.html` },
          { '@type': 'ListItem', position: 2, name: 'Diensten', item: `${siteUrl}/diensten/` },
          { '@type': 'ListItem', position: 3, name: service.navTitle, item: canonical }
        ]
      },
      {
        '@type': 'Service',
        '@id': `${canonical}#service`,
        name: service.navTitle,
        serviceType: service.navTitle,
        description: service.metaDescription,
        url: canonical,
        provider: {
          '@type': 'Organization',
          '@id': `${siteUrl}/#organization`,
          name: 'MNRV',
          url: siteUrl,
          logo: `${siteUrl}/assets/img/MNRV_LOGO.png`,
          email: 'info@mnrv.nl',
          telephone: '+31682456410',
          sameAs: [
            'https://www.linkedin.com/in/davevera/',
            'https://www.instagram.com/mnrv.ai/',
            'https://www.facebook.com/meneervera/'
          ]
        }
      },
      {
        '@type': 'FAQPage',
        mainEntity: service.faq.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer }
        }))
      }
    ]
  };
}

function servicePage(service) {
  const canonical = `${siteUrl}/diensten/${service.slug}/`;
  const deliverables = service.deliverables
    .map(([title, text]) => `<li><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</li>`)
    .join('\n          ');
  const steps = service.steps
    .map(([title, text]) => `<li><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div></li>`)
    .join('\n          ');
  const expertise = service.expertise.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n          ');
  const faq = service.faq
    .map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`)
    .join('\n          ');
  const related = service.related
    .map((slug) => serviceBySlug.get(slug))
    .map((item) => `
      <a class="related-card" href="/diensten/${item.slug}/">
        <p class="related-card__num">${item.number} / Dienst</p>
        <h3>${escapeHtml(item.navTitle)}</h3>
        <p>${escapeHtml(item.card)}</p>
        <span class="related-card__arrow">Bekijk dienst →</span>
      </a>`)
    .join('');
  const sourceNote = service.sourceNote
    ? `<p><strong>Vakjargon met een technisch fundament.</strong> ${escapeHtml(service.sourceNote)}</p>`
    : '';

  return `${documentHead({ title: service.metaTitle, description: service.metaDescription, canonical, schema: serviceSchema(service) })}
<body>
${navigation()}
  <main id="main-content">
    <header class="service-hero">
      <div class="service-hero__inner">
        <ol class="breadcrumbs" aria-label="Kruimelpad">
          <li><a href="/assets/mnrv.html">MNRV</a></li>
          <li><a href="/diensten/">Diensten</a></li>
          <li aria-current="page">${escapeHtml(service.navTitle)}</li>
        </ol>
        <p class="eyebrow">${service.number} / MNRV dienst</p>
        <h1>${escapeHtml(service.title)}</h1>
        <p class="service-hero__lead">${escapeHtml(service.lead)}</p>
        <div class="hero-actions">
          <a class="button button--light" href="/assets/mnrv.html#contact">Bespreek je vraag</a>
          <a class="button button--ghost" href="#wat-we-bouwen">Bekijk wat we bouwen</a>
        </div>
        <ul class="service-tags" aria-label="Expertise">
          ${service.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join('\n          ')}
        </ul>
      </div>
    </header>

    <section class="service-facts" aria-label="Dienst in het kort">
      <article class="service-fact"><p class="service-fact__label">Voor wie</p><p>${escapeHtml(service.audience)}</p></article>
      <article class="service-fact"><p class="service-fact__label">Resultaat</p><p>${escapeHtml(service.result)}</p></article>
      <article class="service-fact"><p class="service-fact__label">Samenwerking</p><p>${escapeHtml(service.collaboration)}</p></article>
    </section>

    <section class="content-section">
      <div class="section-grid">
        <div class="section-heading">
          <p class="eyebrow">Context</p>
          <h2>${escapeHtml(service.summaryHeading)}</h2>
        </div>
        <div class="section-heading">
          ${service.summary.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n          ')}
          ${sourceNote}
        </div>
      </div>
    </section>

    <section class="content-section" id="wat-we-bouwen">
      <div class="section-grid">
        <div class="section-heading">
          <p class="eyebrow">Wat we bouwen</p>
          <h2>Van strategie naar een werkend systeem.</h2>
          <p>De exacte scope volgt uit je organisatie en doelen. Deze bouwstenen vormen meestal de kern.</p>
        </div>
        <ul class="deliverables">
          ${deliverables}
        </ul>
      </div>
    </section>

    <section class="content-section content-section--dark">
      <div class="section-grid">
        <div class="section-heading">
          <p class="eyebrow">Aanpak</p>
          <h2>Beheerst van analyse naar productie.</h2>
          <p>We maken keuzes en risico’s zichtbaar, testen met echte scenario’s en bouwen alleen complexiteit die aantoonbaar nodig is.</p>
        </div>
        <ol class="process-list">
          ${steps}
        </ol>
      </div>
    </section>

    <section class="content-section">
      <div class="section-grid">
        <div class="section-heading">
          <p class="eyebrow">Techniek & expertise</p>
          <h2>Een stack die past bij het probleem.</h2>
          <p>Geen vooraf opgelegd platform. We kiezen technologie op basis van beheer, integraties, risico, snelheid en totale eigendomskosten.</p>
        </div>
        <ul class="expertise-list">
          ${expertise}
        </ul>
      </div>
    </section>

    <section class="content-section">
      <div class="section-grid">
        <div class="section-heading">
          <p class="eyebrow">Veelgestelde vragen</p>
          <h2>Voor je een traject start.</h2>
        </div>
        <div class="faq-list">
          ${faq}
        </div>
      </div>
    </section>

    <section class="related-services" aria-labelledby="related-title">
      <p class="eyebrow">Samenhangende expertise</p>
      <h2 id="related-title">Bekijk gerelateerde diensten.</h2>
      <div class="related-grid">${related}
      </div>
    </section>

    <section class="cta-panel" aria-labelledby="cta-title">
      <h2 id="cta-title">Bespreek wat deze dienst voor jouw organisatie moet oplossen.</h2>
      <p>We starten bij het proces, de gebruiker en het gewenste resultaat. Daarna bepalen we de kleinste verantwoorde route naar productie.</p>
      <div class="hero-actions">
        <a class="button button--light" href="/assets/mnrv.html#contact">Start een project</a>
        <a class="button button--ghost" href="mailto:info@mnrv.nl">Mail info@mnrv.nl</a>
      </div>
    </section>
  </main>
${footer()}
</body>
</html>
`;
}

function hubSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'MNRV', item: `${siteUrl}/assets/mnrv.html` },
          { '@type': 'ListItem', position: 2, name: 'Diensten', item: `${siteUrl}/diensten/` }
        ]
      },
      {
        '@type': 'CollectionPage',
        name: 'Diensten van MNRV',
        description: 'Websites, apps, AI-agenten, maatwerksoftware, workforce automation, reputatie-intelligentie, kennisinfrastructuur, e-commerce en SEO.',
        url: `${siteUrl}/diensten/`,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: services.map((service, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: service.navTitle,
            url: `${siteUrl}/diensten/${service.slug}/`
          }))
        }
      }
    ]
  };
}

function hubPage() {
  const cards = services.map((service) => `
      <a class="service-card" href="/diensten/${service.slug}/">
        <p class="service-card__num">${service.number} / Dienst</p>
        <h2>${escapeHtml(service.navTitle)}</h2>
        <p>${escapeHtml(service.card)}</p>
        <span class="service-card__arrow">Verdiep deze dienst →</span>
      </a>`).join('');

  return `${documentHead({
    title: 'Digitale diensten voor web, AI, e-commerce en SEO | MNRV',
    description: 'Bekijk de diensten van MNRV: websites, apps, AI-agenten, maatwerk, workforce automation, reputatie, kennisinfrastructuur, e-commerce en AI-vindbaarheid.',
    canonical: `${siteUrl}/diensten/`,
    schema: hubSchema()
  })}
<body>
${navigation()}
  <main id="main-content">
    <header class="hub-hero">
      <div class="hub-hero__inner">
        <ol class="breadcrumbs" aria-label="Kruimelpad">
          <li><a href="/assets/mnrv.html">MNRV</a></li>
          <li aria-current="page">Diensten</li>
        </ol>
        <p class="eyebrow">Strategie · Operations · Design · Development · AI</p>
        <h1>Digitale diensten die systemen laten samenwerken.</h1>
        <p class="hub-hero__lead">Van website en commerceplatform tot AI-agent, kennislaag en workforce automation. MNRV verbindt de disciplines die nodig zijn om een digitale oplossing echt te laten werken.</p>
        <div class="hero-actions">
          <a class="button button--light" href="#alle-diensten">Bekijk alle diensten</a>
          <a class="button button--ghost" href="/assets/mnrv.html#contact">Bespreek je vraag</a>
        </div>
      </div>
    </header>

    <section class="content-section" id="alle-diensten">
      <div class="section-heading">
        <p class="eyebrow">Acht expertises, één architectuur</p>
        <h2>Kies het vertrekpunt. We bewaken de samenhang.</h2>
        <p>Een project kan bij één dienst beginnen en meerdere disciplines raken. Iedere pagina legt uit wat we bouwen, voor wie, hoe we werken en welke expertise aansluit.</p>
      </div>
      <div class="service-grid" style="margin-top: 46px;">${cards}
      </div>
    </section>

    <section class="content-section content-section--dark">
      <div class="section-heading">
        <p class="eyebrow">Werkwijze</p>
        <h2>Compact team, korte lijnen, aantoonbaar resultaat.</h2>
      </div>
      <div class="working-method">
        <article><span>01 / Begrijpen</span><h2>Proces vóór technologie</h2><p>We brengen gebruikers, doelen, data, systemen en risico’s samen voordat we een oplossing kiezen.</p></article>
        <article><span>02 / Bouwen</span><h2>Werkend vóór uitgebreid</h2><p>We leveren de kleinste waardevolle kern, testen met echte scenario’s en breiden gecontroleerd uit.</p></article>
        <article><span>03 / Beheren</span><h2>Overdraagbaar vóór afhankelijk</h2><p>Architectuur, logging, documentatie en eigenaarschap maken de oplossing beheersbaar na lancering.</p></article>
      </div>
    </section>

    <section class="cta-panel" aria-labelledby="hub-cta-title" style="margin-top: clamp(78px, 9vw, 128px);">
      <h2 id="hub-cta-title">Nog niet zeker welke dienst het vertrekpunt is?</h2>
      <p>Beschrijf het probleem, de huidige systemen en het gewenste resultaat. We helpen de vraag afbakenen voordat er techniek wordt gekozen.</p>
      <div class="hero-actions">
        <a class="button button--light" href="/assets/mnrv.html#contact">Start een project</a>
        <a class="button button--ghost" href="mailto:info@mnrv.nl">Mail info@mnrv.nl</a>
      </div>
    </section>
  </main>
${footer()}
</body>
</html>
`;
}

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'index.html'), hubPage(), 'utf8');

for (const service of services) {
  const serviceDir = path.join(outputDir, service.slug);
  await mkdir(serviceDir, { recursive: true });
  await writeFile(path.join(serviceDir, 'index.html'), servicePage(service), 'utf8');
}

console.log(`Generated ${services.length + 1} service pages in ${outputDir}`);
