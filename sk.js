/* Fretwork: Slovak texts. Translates the interface in place (text nodes and a few attributes). Only loaded behaviour: window.SKI.start() is called by app.js when the language is Slovak. */
(function () {
'use strict';

/* exact phrases: English -> Slovak (matched on the trimmed text of a text node, or of an attribute) */
const D = {
  // header / navigation
  'Fretwork – Guitar Chord Workshop': 'Fretwork – gitarová dielňa akordov',
  'Chords': 'Akordy', 'Find': 'Hľadaj', 'Theory': 'Teória', 'Songs': 'Piesne',
  'How chords are built': 'Ako sú akordy postavené',
  'Place your fingers and find the chord': 'Polož prsty a nájdi akord',
  'How to read a chord diagram': 'Ako čítať akordový diagram',
  'Language / Jazyk': 'Jazyk / Language', 'Language': 'Jazyk',
  'Profile': 'Profil', 'Guest': 'Hosť', 'Settings': 'Nastavenia',
  'Fretwork · tap any diagram to hear it': 'Fretwork',
  // chords view
  'Chord': 'Akord', 'Chord name': 'Názov akordu', 'Clear': 'Vymazať', 'Root note': 'Základný tón', 'Chord quality': 'Druh akordu',
  'Am7, F#m7b5, Cmaj9/E …': 'Ami7, Fismi7b5, Cmaj9/H …',
  'major': 'dur', 'minor': 'mol',
  'Fewer ▴': 'Menej ▴',
  'Stickers': 'Nálepky', 'Stickers sit behind everything. Drag a visible one to move it, or use Across and Down. Tap a number to pick a sticker.': 'Nálepky sú vždy za všetkým. Viditeľnú môžeš potiahnuť, alebo použi Vodorovne a Zvisle. Ťukni na číslo a vyber nálepku.', 'Across': 'Vodorovne', 'Down': 'Zvisle',
  'Shape': 'Tvar', 'Circle': 'Kruh', 'Burst': 'Výbuch', 'Star': 'Hviezda', 'Label': 'Štítok', 'Anarchy': 'Anarchia', 'Fill colour': 'Farba výplne', 'Text colour': 'Farba textu', 'Size': 'Veľkosť', 'Turn': 'Natočenie', 'Text': 'Text', 'Reset to default': 'Vrátiť pôvodné',
  'Tweak the look (style lab)': 'Upraviť vzhľad (štúdio)', 'Style lab': 'Štúdio vzhľadu', 'Done': 'Hotovo',
  'Guitar finish': 'Povrch gitary', 'Colour shift': 'Posun farby', 'Battered wood (dings and scratches)': 'Ošúchané drevo (škrabance a vrypy)',
  'Progressions': 'Postupy akordov', '＋ New progression': '＋ Nový postup', 'New progression': 'Nový postup', 'Edit progression': 'Upraviť postup',
  'Save a sequence of chords, such as Em C G D, and let the app play it for you to practise along.': 'Ulož si postupnosť akordov, napríklad Emi C G D, a nechaj aplikáciu, aby ti ju zahrala na cvičenie.',
  'Chords in order': 'Akordy v poradí', 'Nothing yet. Add chords below.': 'Zatiaľ nič. Pridaj akordy nižšie.', 'Add a chord, e.g. Em': 'Pridaj akord, napr. Emi',
  'Add': 'Pridať', 'Name': 'Názov', '▶ Play': '▶ Hrať', '■ Stop': '■ Stop', '▶ Play chords': '▶ Zahrať akordy', 'Speed': 'Rýchlosť', 'Slow': 'Pomaly', 'Medium': 'Stredne', 'Fast': 'Rýchlo',
  'Beats per chord': 'Dôb na akord', 'Loop': 'Opakovať', 'Click on each beat': 'Kliknutie na každú dobu', 'Close': 'Zavrieť', 'Add at least one chord': 'Pridaj aspoň jeden akord', 'Progression saved': 'Postup uložený',
  'e.g. My first four': 'napr. Moje prvé štyri', 'Edit': 'Upraviť', 'Save': 'Uložiť', 'Delete': 'Zmazať', 'Cancel': 'Zrušiť',
  '◇ Hide this shape': '◇ Skryť tento hmat', '◇ Show this shape again': '◇ Znova zobraziť tento hmat', '↺ Reset this chord': '↺ Obnoviť tento akord',
  'Hidden from students': 'Skryté pre žiakov',
  'Songs you can play': 'Piesne, ktoré zahráš',
  'chords only, no lyrics': 'len akordy, bez textu',
  'Find chords ↗': 'Nájsť akordy ↗',
  'Find chords for this song online ↗': 'Nájsť akordy k tejto piesni online ↗',
  '♪ Songs you can play with these chords': '♪ Piesne s týmito akordmi',
  'Main chord progressions of well-known songs, simplest first. Chords like E5 or G5 are power chords: two or three strings, one shape you slide up and down the neck. “Find chords” opens a web search in a new tab, where you can look for the full chart.': 'Hlavné akordové postupy známych piesní, od najjednoduchších. Akordy ako E5 alebo G5 sú power akordy: dve alebo tri struny, jeden hmat, ktorý posúvaš po hmatníku. „Nájsť akordy“ otvorí vyhľadávanie na webe v novej karte, kde nájdeš celý zápis.',
  'Help': 'Pomoc',
  'Your first 4 chords': 'Tvoje prvé 4 akordy',
  'Mark as learned': 'Označiť ako naučené',
  '✓ I can play this': '✓ Toto už viem zahrať',
  '♪ Play a song with these chords': '♪ Zahraj pieseň s týmito akordmi',
  'Scarborough Fair': 'Scarborough Fair',
  'Traditional · uses only Em, G, D, Am': 'Ľudová · len Emi, G, D, Ami',
  'show the technical names': 'ukázať odborné názvy',
  'Beginner mode: easy shapes and plain chord names': 'Režim pre začiatočníkov: ľahké hmaty a jednoduché názvy akordov',
  'Welcome to Fretwork': 'Vitaj vo Fretwork',
  'How much guitar have you played?': 'Koľko si už hral na gitare?',
  "I'm new: keep it simple": 'Som nový: nech je to jednoduché',
  "I've played before: show everything": 'Už som hral: ukáž všetko',
  'You can change this any time in Settings.': 'Dá sa to kedykoľvek zmeniť v Nastaveniach.',
  'Show only easy shapes': 'Zobraziť len ľahké hmaty',
  'easiest first': 'najľahšie prvé',
  '▶ New here? How to read a chord diagram': '▶ Začínaš s hraním? Ako čítať akordový diagram',
  'Tap a root note and a quality above, or type any chord, however strange.': 'Ťukni hore na základný tón a druh akordu, alebo napíš akýkoľvek akord, aj ten najčudnejší.',
  'Other voicings': 'Ďalšie tvary', 'My voicings': 'Moje tvary',
  '▶ Strum': '▶ Zahraj', '★ My voicing': '★ Môj tvar', '☆ Use in my songs': '☆ Použiť v mojich piesňach', 'Theory ›': 'Teória ›',
  '◆ Make primary': '◆ Urobiť primárnym', '◆ Primary (tap to clear)': '◆ Primárny (ťukni na zrušenie)',
  'Fingers': 'Prsty', 'Notes': 'Tóny', 'Intervals': 'Intervaly',
  'Tuning': 'Ladenie', 'Shape': 'Tvar', 'Open position': 'Otvorená poloha',
  'Barre': 'Barré', 'Easy': 'Ľahké', 'Recommended': 'Odporúčané', 'no shape': 'bez tvaru',
  'Bass note': 'Basový tón',
  ': the lowest string you play (blue ring). Strings below it stay muted.': ': najnižšia struna, ktorú zahráš (modrý krúžok). Struny pod ňou zostanú stlmené.',
  'Pick the voicing you want to see for this chord in your songs.': 'Vyber tvar, ktorý chceš pri tomto akorde vidieť vo svojich piesňach.',
  'Done': 'Hotovo', 'Cancel': 'Zrušiť', 'Save': 'Uložiť', 'Delete': 'Zmazať', 'Close': 'Zavrieť', 'Edit': 'Upraviť', 'Back': 'Späť', 'Next': 'Ďalej', 'Skip': 'Preskočiť',
  'Open': 'Otvoriť', 'Paste': 'Vložiť', 'Import': 'Importovať', 'Change': 'Zmeniť', 'Name': 'Meno', 'Email': 'E-mail', 'Optional': 'Voliteľné',
  // non-standard tuning banner
  'Non-standard tuning': 'Neštandardné ladenie',
  'Tune your guitar to match, diagrams are shifted for it.': 'Naladi gitaru podľa toho, diagramy sú na to upravené.',
  'Back to standard': 'Späť na štandardné',
  // find
  'Find chord': 'Hľadaj akord',
  'Place your fingers on the neck and Fretwork names the chord.': 'Polož prsty na hmatník a Fretwork pomenuje akord.',
  'Tap': 'Ťukni', ' a spot on the neck to put a finger there. Tap it again to lift it.': ' na miesto na hmatníku a polož tam prst. Ďalším ťuknutím ho zdvihneš.',
  'Drag': 'Potiahni', ' along one fret to lay a finger across several strings (a barre).': ' po jednom páse, aby si prst položil naprieč viacerými strunami (barré).',
  'Tap the circle': 'Ťukni na krúžok', ' above a string to mute it (✕) or let it ring open (○).': ' nad strunou: stlmíš ju (✕) alebo ju necháš znieť prázdnu (○).',
  'Neck position': 'Poloha na hmatníku', 'Strings, low to high:': 'Struny od najnižšej po najvyššiu:',
  'Traditional · chords above lyrics': 'Ľudová · akordy nad textom', 'Weird chord playground': 'Ihrisko zvláštnych akordov', 'Fretwork · tap each chord': 'Fretwork · ťukni na každý akord',
  'Move up the neck towards the nut': 'Posunúť k nultému pražcu', 'Move down the neck': 'Posunúť nižšie po hmatníku',
  'It could be': 'Môže to byť', 'complete': 'úplný', 'Clear all': 'Vymazať všetko',
  // theory
  'See how any chord is built: its intervals, its scale, and where it fits.': 'Pozri, ako je akord postavený: jeho intervaly, stupnicu a kde zapadá.',
  'Cmaj7, F#m7b5, G13 …': 'Cmaj7, Fismi7b5, G13 …', 'Chord for theory': 'Akord pre teóriu',
  'Chord types at a glance': 'Druhy akordov v skratke',
  'Tap a row to see that type built on your chord\'s root.': 'Ťukni na riadok a uvidíš daný druh postavený na základnom tóne tvojho akordu.',
  'Type a chord above, or pick one from the list below.': 'Napíš akord vyššie, alebo vyber jeden zo zoznamu nižšie.',
  'See all voicings': 'Zobraziť všetky tvary',
  'The building blocks': 'Stavebné kamene', 'Built from the major scale': 'Postavené z durovej stupnice', 'Stacked thirds': 'Navrstvené tercie',
  'Where it lives': 'Kde sa nachádza', 'Same notes, other names': 'Rovnaké tóny, iné názvy', 'On the guitar': 'Na gitare',
  'Chord symbols you may meet': 'Značky akordov, s ktorými sa stretneš',
  'Step': 'Stupeň', 'Interval': 'Interval', 'Semitones': 'Poltóny', 'Note': 'Tón', 'What it does': 'Čo robí',
  'Symbol': 'Značka', 'Steps': 'Stupne', 'Notes in C': 'Tóny v C', 'Sound': 'Zvuk', 'Usual name': 'Bežný názov', 'Other marks': 'Iné značky',
  'often left out on guitar': 'na gitare sa často vynecháva',
  'A semitone is one fret on the guitar (a half step). An octave is 12. Extensions wrap around: a 9th is 14 semitones above the root, the same note as the 2nd, one octave higher.': 'Poltón je jeden pražec na gitare. Oktáva má 12 poltónov. Rozšírenia sa „prevíjajú“: nona je 14 poltónov nad základným tónom, rovnaký tón ako sekunda, len o oktávu vyššie.',
  'Most chords are built by stacking notes a third apart, every other note of the scale.': 'Väčšina akordov vzniká navrstvením tónov po terciách, teda každý druhý tón stupnice.',
  'No alterations: every note comes straight from the major scale.': 'Žiadne alterácie: každý tón pochádza priamo z durovej stupnice.',
  'This chord uses only notes of these major keys, so it fits naturally there:': 'Tento akord obsahuje len tóny týchto durových tónin, takže sa tam prirodzene hodí:',
  'Roman numerals count the root\'s position in the key. Capitals are major, small letters are minor.': 'Rímske číslice určujú stupeň základného tónu v tónine. Veľké sú durové, malé molové.',
  'This chord is not made only from notes of a major scale, so it is a “colour” chord: it borrows notes from outside the key to add tension.': 'Tento akord nie je zložený len z tónov jednej durovej stupnice, je to „farebný“ akord: požičiava si tóny spoza tóniny a pridáva napätie.',
  'The same pitches can be named differently depending on which note you hear as the root:': 'Rovnaké tóny sa dajú pomenovať rôzne, podľa toho, ktorý tón počuješ ako základný:',
  'In practice:': 'V praxi:',
  'Chord charts use different marks for the same chord. Fretwork understands all of these, so you can type them or paste them into a song.': 'V spevníkoch sa ten istý akord píše rôznymi značkami. Fretwork rozumie všetkým, takže ich môžeš písať aj vkladať do piesní.',
  'The triangle (Δ or △) always means a major 7th. A small circle (°) means diminished, a circle with a slash (ø) means half-diminished, and a dash (−) means minor.': 'Trojuholník (Δ alebo △) vždy znamená durový septakord (veľká septima). Malý krúžok (°) je zmenšený akord, prečiarknutý krúžok (ø) polozmenšený a pomlčka (−) molový.',
  'Major 7th': 'Durový septakord', 'Minor': 'Molový akord', 'Minor 7th': 'Molový septakord', 'Minor major 7th': 'Molovo-durový septakord',
  'Diminished': 'Zmenšený', 'Diminished 7th': 'Zmenšený septakord', 'Half-diminished': 'Polozmenšený', 'Augmented': 'Zväčšený', 'Suspended 4th': 'Zdržaný (sus4)',
  'major third': 'veľká tercia', 'minor third': 'malá tercia', 'major second': 'veľká sekunda', 'perfect fourth': 'čistá kvarta',
  // slash chords (English page parts that stay as plain text nodes)
  // songs
  'Song book': 'Spevník', '＋ Import song': '＋ Importovať pieseň', 'Examples': 'Ukážky', '‹ Songs': '‹ Piesne',
  'Transpose': 'Transpozícia', 'Text': 'Text', 'Chord charts': 'Diagramy akordov', 'Smaller': 'Menšie', 'Bigger': 'Väčšie',
  'Down a semitone': 'O poltón nižšie', 'Up a semitone': 'O poltón vyššie', 'Save a copy': 'Uložiť kópiu', 'Untitled': 'Bez názvu',
  'No songs yet. Import one: paste text from any chord site, or open a ChordPro / text file.': 'Zatiaľ žiadne piesne. Importuj nejakú: vlož text z ľubovoľnej stránky s akordmi, alebo otvor súbor ChordPro či textový súbor.',
  'Traditional · ChordPro format': 'Ľudová · formát ChordPro', 'Traditional': 'Ľudová',
  'Chorus': 'Refrén', 'Bridge': 'Mostík', 'Intro': 'Predohra', 'Outro': 'Dohra', 'Solo': 'Sólo', 'Interlude': 'Medzihra',
  'Import a song': 'Importovať pieseň', 'Edit song': 'Upraviť pieseň',
  'Paste chords-over-lyrics text (the usual format on chord sites) or ChordPro with [Am] inline chords. You can also open a .txt, .cho, .crd or .pro file.': 'Vlož text s akordmi nad textom (bežný formát na stránkach s akordmi) alebo ChordPro s akordmi v [zátvorkách], napr. [Ami]. Môžeš otvoriť aj súbor .txt, .cho, .crd alebo .pro.',
  'Title': 'Názov', 'Artist': 'Interpret', 'Song text': 'Text piesne', 'Song title': 'Názov piesne',
  '   Am        G\nPaste lyrics with chords here…': '   Ami       G\nVlož sem text s akordmi…',
  'Open file…': 'Otvoriť súbor…',
  'No chords recognised yet. Chords must be on their own line above lyrics, or in [brackets].': 'Zatiaľ sa nerozpoznal žiadny akord. Akordy musia byť na vlastnom riadku nad textom, alebo v [hranatých zátvorkách].',
  // settings
  'Create your own tuning': 'Vytvor si vlastné ladenie',
  'Name, e.g. My open D': 'Názov, napr. Moje otvorené D',
  'low': 'nízka', 'high': 'vysoká',
  'Save tuning': 'Uložiť ladenie', 'Delete current tuning': 'Zmazať toto ladenie',
  'Dot labels': 'Popisky bodiek',
  'Left-handed diagrams': 'Diagramy pre ľavákov',
  'Use flats (B♭) instead of sharps': 'Používať béčka (Des, Es, As) namiesto krížikov (Cis, Dis, Gis)',
  'Teacher mode: pick the primary voicing': 'Režim učiteľa: vyber primárny tvar',
  'Open a chord and press “Make primary” under its diagram. Primary shapes show as Recommended and open first for everyone. Export the file and save it as': 'Otvor akord a stlač „Urobiť primárnym“ pod jeho diagramom. Primárne tvary sa zobrazia ako Odporúčané a pre všetkých sa otvoria ako prvé. Súbor exportuj a ulož ako',
  'next to index.html to publish your picks.': 'vedľa index.html, aby si svoj výber zverejnil.',
  'Export primary.json': 'Exportovať primary.json', 'Clear my changes': 'Zrušiť moje zmeny',
  'Remove all primary-voicing changes made on this device?': 'Odstrániť všetky zmeny primárnych tvarov urobené na tomto zariadení?',
  // toasts and messages
  'Tuning saved. Diagrams updated.': 'Ladenie uložené. Diagramy sú aktualizované.',
  'Give the tuning a name': 'Daj ladeniu názov', 'That name is already used': 'Tento názov sa už používa',
  'Back to the automatic voicing': 'Späť na automatický tvar', 'Pick a root note first': 'Najprv vyber základný tón',
  'Saved': 'Uložené', 'Add some song text first': 'Najprv pridaj text piesne',
  'Paste with long-press / Ctrl+V into the box': 'Vlož dlhým podržaním alebo Ctrl+V do poľa',
  'Primary voicings imported': 'Primárne tvary boli importované', 'That is not a primary.json file': 'Toto nie je súbor primary.json',
  'Storage is full or blocked': 'Úložisko je plné alebo zablokované',
  // profile / account
  'Your profile': 'Tvoj profil', 'Your account': 'Tvoj účet',
  'PIN (4+ characters)': 'PIN (aspoň 4 znaky)', 'Create profile': 'Vytvoriť profil', 'Delete this profile': 'Zmazať tento profil',
  'Password (8+ characters)': 'Heslo (aspoň 8 znakov)', 'New password (8+ characters)': 'Nové heslo (aspoň 8 znakov)',
  'Sign in': 'Prihlásiť sa', 'Sign out': 'Odhlásiť sa', 'Create account': 'Vytvoriť účet', 'Forgot password?': 'Zabudnuté heslo?',
  'Choose a new password': 'Zvoľ nové heslo', 'Save password': 'Uložiť heslo',
  'Export backup': 'Exportovať zálohu', 'Import backup': 'Importovať zálohu',
  'Copy my guest songs and settings': 'Skopírovať moje piesne a nastavenia hosťa', 'Copy my guest songs into the account': 'Skopírovať moje piesne hosťa do účtu',
  'You are using Fretwork as a guest. Everything works and stays in this browser. An account keeps your songs and voicings safe and in sync across your phone, tablet and computer.': 'Používaš Fretwork ako hosť. Všetko funguje a ostáva v tomto prehliadači. Účet uchová tvoje piesne a tvary v bezpečí a zosynchronizuje ich medzi telefónom, tabletom a počítačom.',
  'You are using Fretwork as a guest. Everything works, and your songs stay in this browser. A profile keeps your own separate library, so several people can share one device.': 'Používaš Fretwork ako hosť. Všetko funguje a tvoje piesne ostávajú v tomto prehliadači. Profil si vedie vlastnú knižnicu, takže sa o jedno zariadenie môže deliť viac ľudí.',
  'Profiles are stored on this device only. Use Export backup to move your library to another device.': 'Profily sú uložené iba v tomto zariadení. Knižnicu presunieš na iné zariadenie cez Exportovať zálohu.',
  'You are signed in. Your songs and chosen voicings are kept in your own library on this device.': 'Si prihlásený. Tvoje piesne a vybrané tvary sú uložené vo vlastnej knižnici na tomto zariadení.',
  'Signed in. Your songs and chosen voicings sync to your account and appear on every device you sign in on.': 'Si prihlásený. Tvoje piesne a vybrané tvary sa synchronizujú s účtom a objavia sa na každom zariadení, kde sa prihlásiš.',
  'Almost done. Check your email, confirm the address, then sign in.': 'Skoro hotovo. Pozri si e-mail, potvrď adresu a potom sa prihlás.',
  'Account created': 'Účet bol vytvorený', 'Signed in': 'Prihlásený', 'Signed out': 'Odhlásený', 'Profile created': 'Profil bol vytvorený',
  'Password updated': 'Heslo bolo zmenené', 'Backup imported': 'Záloha bola importovaná', 'That file is not a Fretwork backup': 'Toto nie je záloha Fretworku',
  'Enter a name and a PIN of at least 4 characters.': 'Zadaj meno a PIN aspoň so 4 znakmi.',
  'Enter a valid email and a password of 8+ characters.': 'Zadaj platný e-mail a heslo s aspoň 8 znakmi.',
  'Name or PIN not recognised.': 'Meno alebo PIN sa nezhodujú.', 'That name is taken on this device.': 'Toto meno už je na tomto zariadení obsadené.',
  'Use at least 8 characters.': 'Použi aspoň 8 znakov.',
  'Cloud is not reachable right now.': 'Cloud je momentálne nedostupný.', 'Cloud unavailable. Working on this device.': 'Cloud nie je dostupný. Pracuješ na tomto zariadení.',
  'Could not sync. Saved on this device.': 'Synchronizácia sa nepodarila. Uložené v tomto zariadení.',
  'Type your email above first, then tap Forgot password.': 'Najprv vyššie napíš e-mail a potom ťukni na Zabudnuté heslo.',
  'One moment…': 'Chvíľku…',
  // tour
  'Meet the guitar': 'Zoznám sa s gitarou', 'Stand it up': 'Postav ju', 'Zoom in on the neck': 'Priblíž hmatník', 'This is the chord grid': 'Toto je mriežka akordu',
  'Vertical lines are strings': 'Zvislé čiary sú struny', 'Horizontal lines are frets': 'Vodorovné čiary sú pražce', 'Dots show where to press': 'Bodky ukazujú, kam pritlačiť',
  'O and X above the grid': 'O a X nad mriežkou', 'Put it together': 'Spoj to dokopy',
  'Animation: a guitar stands up and zooms in to become a chord diagram': 'Animácia: gitara sa postaví a priblíži sa, až z nej vznikne akordový diagram',
  'How to read a chord diagram ': 'Ako čítať akordový diagram',
  'bass': 'bas', 'skip': 'nehrať', 'open': 'prázdna',
  'Body': 'Telo', 'Neck': 'Krk', 'Headstock': 'Hlava', 'Thickest string': 'Najhrubšia struna', 'is on top': 'je navrchu', 'nut': 'nultý pražec',
  'This is a guitar the way you see a <b>right-handed</b> player: <b>body</b> on the left, <b>neck</b> pointing right, <b>headstock</b> with the tuning pegs at the end. Check the <b>thickest string</b>: it is on top. That means you are holding it the right way round. (Left-handed? Turn on left-handed diagrams in Settings.)':
    'Takto vidíš gitaru pravákovho hráča: <b>telo</b> vľavo, <b>krk</b> smeruje doprava a na konci je <b>hlava</b> s ladiacimi kolíkmi. Pozri na <b>najhrubšiu strunu</b>: je navrchu. To znamená, že gitaru držíš správne. (Si ľavák? V Nastaveniach zapni diagramy pre ľavákov.)',
  'Now tip the neck up, headstock on top, as if you held it up in front of you. The thickest string ends up on the <b>left</b>, and that is exactly how every chord diagram is drawn.':
    'Teraz postav krk nahor, hlavou hore, akoby si gitaru držal pred sebou. Najhrubšia struna skončí <b>vľavo</b> a presne tak sa kreslí každý akordový diagram.',
  'Most basic chords are played on the first few frets, just below the headstock. A chord diagram shows just this small part of the neck. Higher up the neck, the diagram simply starts at a higher fret.':
    'Základné akordy sa hrajú na prvých pár pražcoch, tesne pod hlavou. Akordový diagram ukazuje len túto malú časť hmatníka. Vyššie na hmatníku diagram jednoducho začína na vyššom pražci.',
  'To keep the picture small, the frets are squeezed closer together. Now let’s read it, one part at a time.':
    'Aby bol obrázok malý, pražce sú stlačené bližšie k sebe. Teraz si ho prečítame, časť po časti.',
  'Six lines, six strings. The thick one on the <b>left</b> makes the lowest sound (low E). The thin one on the <b>right</b> is the highest.':
    'Šesť čiar, šesť strún. Hrubá <b>vľavo</b> hrá najnižší tón (nízke E). Tenká <b>vpravo</b> je najvyššia.',
  'The thick bar on top is the <b>nut</b>, where the strings start. Every line below it is a metal <b>fret</b>. The gaps are numbered 1, 2, 3 … counting down from the nut.':
    'Hrubý pás navrchu je <b>nultý pražec</b>, kde struny začínajú. Každá čiara pod ním je kovový <b>pražec</b>. Medzery sú číslované 1, 2, 3 … smerom od nultého pražca nadol.',
  'A dot means: press this string, in this gap, just behind the fret line. The number in the dot is the finger: <b>1</b> index, <b>2</b> middle, <b>3</b> ring, <b>4</b> little.':
    'Bodka znamená: pritlač túto strunu v tejto medzere, tesne za pražcom. Číslo v bodke je prst: <b>1</b> ukazovák, <b>2</b> prostredník, <b>3</b> prstenník, <b>4</b> malíček.',
  '<b>O</b> means play that string <b>open</b>, with no finger on it. <b>X</b> means <b>don’t play</b> that string.':
    '<b>O</b> znamená hrať strunu <b>prázdnu</b>, bez prsta. <b>X</b> znamená túto strunu <b>nehrať</b>.',
  'This is <b>C major</b>. Skip the thickest string, press three strings, and strum the rest. The <b>red</b> dots are the root note, the one the chord is named after.':
    'Toto je <b>C dur</b>. Najhrubšiu strunu vynechaj, pritlač tri struny a prejdi cez zvyšné. <b>Červené</b> bodky sú základný tón, podľa ktorého sa akord volá.',
  // intervals and roles (engine)
  'Root (perfect unison)': 'Základný tón (čistá prima)', 'Minor third': 'Malá tercia', 'Major third': 'Veľká tercia', 'Major second': 'Veľká sekunda',
  'Perfect fourth': 'Čistá kvarta', 'Diminished fifth (tritone)': 'Zmenšená kvinta (tritón)', 'Perfect fifth': 'Čistá kvinta', 'Augmented fifth': 'Zväčšená kvinta',
  'Major sixth': 'Veľká sexta', 'Diminished seventh': 'Zmenšená septima', 'Minor seventh': 'Malá septima', 'Major seventh': 'Veľká septima',
  'Minor ninth': 'Malá nona', 'Major ninth': 'Veľká nona', 'Augmented ninth': 'Zväčšená nona', 'Perfect eleventh': 'Čistá undecima', 'Augmented eleventh': 'Zväčšená undecima',
  'Minor thirteenth': 'Malá tercdecima', 'Major thirteenth': 'Veľká tercdecima', 'Bass note (slash chord)': 'Basový tón (akord s lomkou)',
  'Anchor: the note the chord is named after.': 'Opora: tón, podľa ktorého sa akord volá.',
  'Decides the mood: a major third makes it major, bright.': 'Určuje náladu: veľká tercia robí akord durovým, jasným.',
  'Decides the mood: a minor third makes it minor, darker.': 'Určuje náladu: malá tercia robí akord molovým, tmavším.',
  'Stands in for the third, so the chord is neither major nor minor.': 'Nahrádza terciu, preto akord nie je ani durový, ani molový.',
  'Stabiliser. Adds fullness, and is the first note players drop.': 'Stabilizuje a dodáva plnosť. Hráči ho vynechávajú ako prvý.',
  'Altered fifth: bends the stability of the chord, adds tension.': 'Alterovaná kvinta: narúša stabilitu akordu a pridáva napätie.',
  'Colour note. With a major third it creates the pull that wants to resolve.': 'Farebný tón. S veľkou terciou vytvára ťah, ktorý sa chce vyriešiť.',
  'Colour note. A major seventh sounds smooth and dreamy.': 'Farebný tón. Veľká septima znie jemne a zasnene.',
  'Fully diminished seventh: tense, symmetrical sound.': 'Zmenšená septima: napätý, symetrický zvuk.',
  'Sweet colour note, a calmer alternative to the seventh.': 'Sladký farebný tón, pokojnejšia alternatíva k septime.',
  'Different lowest note than the root (an inversion or slash chord).': 'Najnižší tón je iný než základný (obrat alebo akord s lomkou).',
  'Altered tension note: spicy colour on top of the chord.': 'Alterovaný napäťový tón: korenistá farba navrchu akordu.',
  'Extension: another third stacked on top of the seventh. Adds richness.': 'Rozšírenie: ďalšia tercia navrstvená na septimu. Pridáva bohatosť.',
  // chord families (engine)
  'Suspended chord': 'Zdržaný akord (sus)',
  'The third is replaced by a second (sus2) or a fourth (sus4). Without a third the chord is neither major nor minor, so it hangs in the air and wants to resolve.': 'Tercia je nahradená sekundou (sus2) alebo kvartou (sus4). Bez tercie nie je akord ani durový, ani molový, takže visí vo vzduchu a chce sa vyriešiť.',
  'Common as a moment of tension before the plain major or minor chord: Dsus4 → D. Also great as a floating, open sound in folk and rock.': 'Častý ako chvíľa napätia pred obyčajným durovým či molovým akordom: Dsus4 → D. Skvelý aj ako vznášavý, otvorený zvuk vo folku a rocku.',
  'Diminished seventh chord': 'Zmenšený septakord',
  'A stack of three minor thirds (3 semitones each). It is perfectly symmetrical: the same four notes repeat every 3 semitones, so each diminished seventh chord has four different names.': 'Navrstvené tri malé tercie (po 3 poltóny). Je dokonale symetrický: tie isté štyri tóny sa opakujú každé 3 poltóny, takže každý zmenšený septakord má štyri rôzne názvy.',
  'Used as a passing chord that connects two chords. Dim7 chords slide up or down by frets and still sound correct.': 'Používa sa ako prechodný akord medzi dvoma akordmi. Dim7 akordy môžeš posúvať po pražcoch hore či dolu a stále znejú správne.',
  'Half-diminished chord (m7♭5)': 'Polozmenšený akord (mi7♭5)',
  'A diminished triad with a minor seventh. It is the ii chord of a minor key, soft but unstable.': 'Zmenšený trojzvuk s malou septimou. Je to akord II. stupňa v molovej tónine, jemný, ale nestabilný.',
  'Typically the ii chord in a minor ii–V–i progression: Bm7♭5 → E7 → Am.': 'Typicky akord II. stupňa v molovom slede ii–V–i: Hmi7♭5 → E7 → Ami.',
  'Diminished triad': 'Zmenšený trojzvuk',
  'Two minor thirds stacked, which makes a tritone (6 semitones) between root and fifth. Very tense and unstable.': 'Dve malé tercie na sebe, čo medzi základným tónom a kvintou vytvára tritón (6 poltónov). Veľmi napätý a nestabilný.',
  'Rare as a stand-alone chord; used to lead into the next chord.': 'Ako samostatný akord je zriedkavý, používa sa na vedenie do ďalšieho akordu.',
  'Augmented chord': 'Zväčšený akord',
  'Two major thirds stacked, a raised fifth. It is symmetrical: the same three notes repeat every 4 semitones, so each augmented chord has three names.': 'Dve veľké tercie na sebe, zvýšená kvinta. Je symetrický: tie isté tri tóny sa opakujú každé 4 poltóny, takže každý zväčšený akord má tri názvy.',
  'Creates floating tension, often right before resolving to the I chord.': 'Vytvára vznášavé napätie, často tesne pred vyriešením do akordu I. stupňa.',
  'Minor-major seventh chord': 'Molovo-durový septakord',
  'A minor triad with a major seventh: the dark minor third sits against a bright seventh. Cinematic, mysterious.': 'Molový trojzvuk s veľkou septimou: tmavá malá tercia stojí proti jasnej septime. Filmový, tajomný.',
  'Think of spy-film themes: Am(maj7) to Am7 to Am6 is a classic descending line.': 'Mysli na hudbu zo špionážnych filmov: Ami(maj7) k Ami7 a Ami6 je klasická zostupná línia.',
  'Minor seventh family': 'Molové septakordy',
  'A minor triad plus a minor seventh. Softer and more relaxed than a plain minor chord. Higher extensions (9, 11, 13) add colour.': 'Molový trojzvuk plus malá septima. Mäkší a uvoľnenejší než obyčajný molový akord. Vyššie rozšírenia (9, 11, 13) pridávajú farbu.',
  'The ii, iii and vi chords of a major key. A jazz favourite: ii7 – V7 – Imaj7.': 'Akordy II., III. a VI. stupňa durovej tóniny. Obľúbený v jazze: ii7 – V7 – Imaj7.',
  'Minor chord': 'Molový akord',
  'Root, minor third, perfect fifth. The minor third (3 semitones) gives the sad, serious or tender colour.': 'Základný tón, malá tercia, čistá kvinta. Malá tercia (3 poltóny) dáva smutnú, vážnu alebo nežnú farbu.',
  'The ii, iii and vi chords of a major key, and the i, iv chords of a minor key.': 'Akordy II., III. a VI. stupňa durovej tóniny a I. a IV. stupňa molovej tóniny.',
  'Major seventh family': 'Durové septakordy',
  'A major triad plus a major seventh, one half step below the octave. Dreamy, warm, slightly wistful.': 'Durový trojzvuk plus veľká septima, o poltón pod oktávou. Zasnený, teplý, trochu túžobný.',
  'The I and IV chords of a major key. A staple of jazz, bossa nova and soft pop.': 'Akordy I. a IV. stupňa durovej tóniny. Základ jazzu, bossa novy a jemného popu.',
  'Dominant seventh family': 'Dominantné septakordy',
  'A major triad with a minor seventh. Between the major third and the minor seventh sits a tritone, the most unstable interval, which creates a strong pull to resolve.': 'Durový trojzvuk s malou septimou. Medzi veľkou terciou a malou septimou je tritón, najnestabilnejší interval, ktorý vytvára silný ťah k vyriešeniu.',
  'Built on the 5th note of a key (V7), it pulls home: G7 → C. In blues, 7 chords are used on I, IV and V.': 'Postavený na 5. stupni tóniny (V7) ťahá domov: G7 → C. V bluese sa septakordy hrajú na I., IV. a V. stupni.',
  'Sixth chord': 'Akord so šestou',
  'A major triad plus a major sixth. Sweet and settled, a calmer alternative to the major seventh.': 'Durový trojzvuk plus veľká sexta. Sladký a ustálený, pokojnejšia alternatíva k durovej septime.',
  'Often used as a gentle ending chord, or a tonic in swing and country.': 'Často sa používa ako jemný záverečný akord alebo tónika vo swingu a country.',
  'Major chord': 'Durový akord',
  'Root, major third, perfect fifth. The major third (4 semitones) gives the bright, stable, happy sound.': 'Základný tón, veľká tercia, čistá kvinta. Veľká tercia (4 poltóny) dáva jasný, stabilný, veselý zvuk.',
  'The I, IV and V chords of a major key: the three chords of countless songs.': 'Akordy I., IV. a V. stupňa durovej tóniny: tri akordy nespočetných piesní.',
  'Power chord': 'Power chord (kvintakord)',
  'Just the root and the fifth. With no third it is neither major nor minor, so it fits either, and it stays clear under distortion.': 'Len základný tón a kvinta. Bez tercie nie je ani durový, ani molový, takže pasuje k obom a pri skreslení zostáva čistý.',
  'The backbone of rock and punk. Play it on two or three strings.': 'Chrbtová kosť rocku a punku. Hrá sa na dvoch alebo troch strunách.',
  'Custom chord': 'Vlastný akord', 'A chord built from the notes shown below.': 'Akord postavený z tónov uvedených nižšie.',
  // theory table types
  'Major': 'Dur', 'Bright, stable, happy': 'Jasný, stabilný, veselý', 'Darker, sad or tender': 'Tmavší, smutný alebo nežný',
  'Open, neutral, strong': 'Otvorený, neutrálny, silný', 'Dominant 7': 'Dominantný septakord', 'Bluesy, wants to resolve': 'Bluesový, chce sa vyriešiť',
  'Major 7': 'Durový septakord', 'Dreamy, warm': 'Zasnený, teplý', 'Minor 7': 'Molový septakord', 'Mellow, relaxed': 'Mäkký, uvoľnený',
  'Major 6': 'Dur so šestou', 'Sweet, settled': 'Sladký, ustálený', 'Minor 6': 'Mol so šestou', 'Wistful, jazzy': 'Túžobný, jazzový',
  'Suspended 2': 'Zdržaný 2', 'Open, floating': 'Otvorený, vznášavý', 'Suspended 4': 'Zdržaný 4', 'Hanging, wants to resolve': 'Visí vo vzduchu, chce sa vyriešiť',
  'Dominant 7 sus 4': 'Dominantný 7 sus 4', 'Gospel, floating tension': 'Gospelový, vznášavé napätie', 'Add 9': 'Pridaná nona', 'Shimmering, modern': 'Trblietavý, moderný',
  'Dominant 9': 'Dominantná nona', 'Funky, rich': 'Funkový, bohatý', 'Minor 9': 'Molová nona', 'Smooth, soulful': 'Hladký, soulový',
  'Major 9': 'Durová nona', 'Lush, dreamy': 'Bujný, zasnený', 'Dominant 11': 'Dominantná undecima', 'Open, ambiguous': 'Otvorený, nejednoznačný',
  'Dominant 13': 'Dominantná tercdecima', 'Big, jazzy': 'Veľký, jazzový', 'Six-nine': 'Šesť-deväť', 'Relaxed, a good ending chord': 'Uvoľnený, dobrý záverečný akord',
  'Tense, unstable': 'Napätý, nestabilný', 'Diminished 7': 'Zmenšený septakord', 'Very tense, symmetrical': 'Veľmi napätý, symetrický',
  'Soft tension, the ii of a minor key': 'Jemné napätie, II. stupeň molovej tóniny', 'Floating, unsettled': 'Vznášavý, nepokojný',
  'Dominant 7 ♭9': 'Dominantný 7 ♭9', 'Dark, spicy tension': 'Tmavé, korenisté napätie', 'Dominant 7 ♯9': 'Dominantný 7 ♯9', 'Gritty, the “Hendrix chord”': 'Drsný, „Hendrixov akord“',
  'Dominant 7 ♯11': 'Dominantný 7 ♯11', 'Bright, jazzy': 'Jasný, jazzový', 'Minor-major 7': 'Molovo-durový septakord', 'Cinematic, mysterious': 'Filmový, tajomný',
  'Altered dominant': 'Alterovaný dominantný', 'Maximum tension': 'Maximálne napätie',
  // chord parse errors
  'Type a chord, for example Am7, F#m7b5 or Cmaj9/E': 'Napíš akord, napríklad Ami7, Fismi7b5 alebo Cmaj9/H',
  'A chord starts with a note name, A to G': 'Akord začína názvom tónu: A, B, C, D, E, F, G, H alebo ich is/es tvary',
  'After the slash I expect a bass note, like C/E': 'Za lomkou čakám basový tón, napríklad C/E',
  'That chord is parsed (': 'Akord je rozpoznaný (',
  // tunings
  'Drop D': 'Drop D', 'Double drop D': 'Double drop D'
};

/* patterns for dynamic text: [regex, replacement string or function] (the regex is run on the trimmed text) */
const P = [
  [/^(\d) of 4 learned$/, '$1 zo 4 naučené'],
  [/^Not a common chord yet\. Try moving a finger, or$/, 'Zatiaľ nie je bežný akord. Skús pohnúť prstom, alebo'],
  [/^More shapes \((\d+)\)$/, 'Ďalšie hmaty ($1)'],
  [/^More chord types \((\d+)\) ▾$/, 'Ďalšie druhy akordov ($1) ▾'],
  [/^(\d+) shapes, low to high$/, '$1 tvarov, od najnižšieho po najvyšší'],
  [/^Starts at fret (\d+)$/, 'Začína na $1. pražci'],
  [/^· Open position$/, '· Otvorená poloha'],
  [/^· Starts at fret (\d+)$/, '· Začína na $1. pražci'],
  [/^Chord diagram, frets (.*)$/, (m, f) => 'Akordový diagram, pražce ' + f.replace(/muted/g, 'stlmená')],
  [/^Use this shape for (.+) in my songs$/, 'Použiť tento tvar pre $1 vo mojich piesňach'],
  [/^Leaves out (.+)$/, 'Vynecháva $1'],
  [/^no (.+)$/, 'bez $1'],
  [/^bass (.+)$/, 'bas $1'],
  [/^Key (.+)$/, 'Tónina $1'],
  [/^inversion$/, 'obrat'],
  [/^Found (\d+) chords?: (.*)$/, 'Nájdených akordov: $1: $2'],
  [/^Step (\d+): (.+)$/, (m, n, t) => 'Krok ' + n + ': ' + tr(t)],
  [/^Saved as your (.+)$/, 'Uložené ako tvoj tvar pre $1'],
  [/^No playable shape found for (.+)$/, 'Pre $1 sa nenašiel hrateľný tvar'],
  [/^(.+): this shape is now the primary voicing$/, '$1: tento tvar je teraz primárny'],
  [/^Primary cleared for (.+)$/, 'Primárny tvar zrušený pre $1'],
  [/^Primary voicings \((\d+)\)$/, 'Primárne tvary ($1)'],
  [/^Welcome back, (.+)$/, 'Vitaj späť, $1'],
  [/^(\d+) semitones$/, '$1 poltónov'],
  [/^Delete “(.+)”\?$/, 'Zmazať „$1“?'],
  [/^Delete profile “(.*)$/, 'Zmazať profil „$1'],
  [/^Verse (\d+)$/, 'Sloha $1'], [/^Verse$/, 'Sloha'], [/^Chorus (\d+)$/, 'Refrén $1'],
  [/^That chord is parsed \((.*)\) but I couldn’t find a playable shape in this tuning\.$/, 'Akord je rozpoznaný ($1), ale v tomto ladení som nenašiel hrateľný tvar.'],
  [/^I don’t recognise “(.*)” in that chord$/, 'V tomto akorde nerozpoznávam „$1“'],
  [/^Start with the (.*)$/, 'Začni $1'],
  [/^Tuning saved/, 'Ladenie uložené']
];

function tr(s) {
  if (s == null) return s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
  if (!core) return s;
  let out = D[core];
  if (out == null && D[s] != null) out = D[s];
  if (out == null && core.indexOf(' · ') > 0) {                                  // “complete · inversion”, “no 5 · inversion”
    const parts = core.split(' · '), t2 = parts.map(x => tr(x)); if (t2.join() !== parts.join()) out = t2.join(' · ');
  }
  if (out == null) {
    for (const [re, rep] of P) { const mm = re.exec(core); if (mm) { out = typeof rep === 'function' ? rep.apply(null, mm) : core.replace(re, rep); break; } }
  }
  return out == null ? s : m[1] + out + m[3];
}

const TH = { 'Name': 'Názov' };      // table headers that clash with other words
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const last = new WeakMap();
function doText(n) {
  const v = n.nodeValue; if (!v || !/[A-Za-z]/.test(v)) return;
  if (last.get(n) === v) return;
  const core = v.trim(), pn = n.parentNode && n.parentNode.nodeName;
  const o = (pn === 'TH' && TH[core]) ? v.replace(core, TH[core]) : tr(v);
  if (o !== v) { n.nodeValue = o; last.set(n, o); }
}
function doEl(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute && el.getAttribute(a);
    if (v) { const o = tr(v); if (o !== v) el.setAttribute(a, o); }
  }
}
function walk(root) {
  if (root.nodeType === 3) { doText(root); return; }
  if (root.nodeType !== 1) return;
  doEl(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
  let n; while ((n = w.nextNode())) { if (n.nodeType === 3) { if (n.parentNode && !/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) doText(n); } else doEl(n); }
}
let started = false;
function start() {
  if (started) return; started = true;
  document.title = tr(document.title);
  walk(document.body);
  new MutationObserver(list => {
    for (const r of list) {
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') doText(r.target);
      else if (r.type === 'attributes') doEl(r.target);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

window.SKI = { tr, start, D, P };
})();
