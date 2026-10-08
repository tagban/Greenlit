// Static game content: genres, sub-genres, critics, name lists.
// Kept as plain data so it can later move to JSON files for modding.

export type GenreId = 'action' | 'drama' | 'comedy' | 'horror' | 'scifi' | 'romance'
export type Dept = 'script' | 'direction' | 'acting' | 'technical' | 'music'
export type Weights = Record<Dept, number>

export const DEPTS: Dept[] = ['script', 'direction', 'acting', 'technical', 'music']
export const DEPT_LABEL: Record<Dept, string> = {
  script: 'Script',
  direction: 'Direction',
  acting: 'Acting',
  technical: 'Technical',
  music: 'Music & sound',
}

export type Genre = {
  id: GenreId
  name: string
  weights: Weights
  audience: string
  youngShare: number // 0..1, share of audience under 25
  peakMonths: number[] // 0 = January
  works: string
  pitfalls: string
  tropes: string
}

export const GENRES: Record<GenreId, Genre> = {
  action: {
    id: 'action',
    name: 'Action',
    weights: { script: 15, direction: 20, acting: 15, technical: 40, music: 10 },
    audience: 'Teens and young adults',
    youngShare: 0.6,
    peakMonths: [4, 5, 6],
    works: 'Action lives on spectacle. Technical budget, stunts and a confident director matter more than a polished script.',
    pitfalls: 'Cheap effects get laughed at. A forgettable villain sinks the second weekend.',
    tropes: 'The one last job, the mentor who dies in act two, walking away from explosions.',
  },
  drama: {
    id: 'drama',
    name: 'Drama',
    weights: { script: 30, direction: 20, acting: 35, technical: 5, music: 10 },
    audience: 'Adults 25+, awards voters',
    youngShare: 0.2,
    peakMonths: [9, 10, 11],
    works: 'Dramas live on performances and a tight second act. Your lead’s skill matters far more than VFX.',
    pitfalls: 'A slow middle loses audiences. Miscast leads are fatal.',
    tropes: 'The big speech, the estranged parent, rain on the window.',
  },
  comedy: {
    id: 'comedy',
    name: 'Comedy',
    weights: { script: 35, direction: 15, acting: 35, technical: 5, music: 10 },
    audience: 'Broad, 15 to 45',
    youngShare: 0.45,
    peakMonths: [5, 6, 11],
    works: 'Comedy is writing plus timing. A sharp script and actors who can land a joke beat any budget.',
    pitfalls: 'Jokes that run long. Casting dramatic actors who can’t do timing.',
    tropes: 'The mix-up, the wedding gone wrong, the mismatched partners.',
  },
  horror: {
    id: 'horror',
    name: 'Horror',
    weights: { script: 20, direction: 25, acting: 10, technical: 25, music: 20 },
    audience: 'Teens and young adults',
    youngShare: 0.65,
    peakMonths: [9],
    works: 'Horror is direction and sound. Atmosphere beats stars, which makes it the indie studio’s best friend.',
    pitfalls: 'Showing the monster too early. A score that tells you when to be scared.',
    tropes: 'Splitting up, the cabin, the phone with no signal.',
  },
  scifi: {
    id: 'scifi',
    name: 'Sci-fi',
    weights: { script: 25, direction: 20, acting: 15, technical: 30, music: 10 },
    audience: 'Young adults and genre fans',
    youngShare: 0.5,
    peakMonths: [4, 5, 11],
    works: 'Sci-fi needs a big idea and the effects to sell it. Fans forgive a lot for a world that feels real.',
    pitfalls: 'Exposition dumps. Effects that age badly.',
    tropes: 'The chosen one, the AI that turns, the countdown.',
  },
  romance: {
    id: 'romance',
    name: 'Romance',
    weights: { script: 30, direction: 15, acting: 40, technical: 5, music: 10 },
    audience: 'Adults, date nights',
    youngShare: 0.35,
    peakMonths: [1, 11],
    works: 'Romance is chemistry. Two well-matched leads matter more than anything else on the call sheet.',
    pitfalls: 'Leads with no spark. A third act that drags out the obvious.',
    tropes: 'The meet-cute, the airport run, the misunderstanding.',
  },
}

export const GENRE_IDS = Object.keys(GENRES) as GenreId[]

export type Subgenre = {
  id: string
  genre: GenreId
  name: string
  shift: Partial<Weights>
  keywords: string[]
  note: string
}

export const SUBGENRES: Subgenre[] = [
  { id: 'police', genre: 'action', name: 'Police', shift: { acting: 5, technical: -5 }, keywords: ['cop', 'detective', 'precinct', 'partner', 'badge'], note: 'Partners with chemistry carry it.' },
  { id: 'military-hist', genre: 'action', name: 'Military (historical)', shift: { acting: 5, technical: 5, script: -5, music: -5 }, keywords: ['war', 'soldier', 'battalion', 'beach', '1944'], note: 'Awards voters love a period war film.' },
  { id: 'military-modern', genre: 'action', name: 'Military (modern)', shift: { technical: 5, direction: 5, script: -10 }, keywords: ['squad', 'mission', 'special forces', 'drone', 'extraction'], note: 'Authenticity and tension over speeches.' },
  { id: 'superhero', genre: 'action', name: 'Superhero', shift: { technical: 15, script: -5, acting: -5, music: -5 }, keywords: ['hero', 'powers', 'villain', 'mask', 'origin'], note: 'Huge when hot, prone to fatigue.' },
  { id: 'martial-arts', genre: 'action', name: 'Martial arts', shift: { direction: 10, technical: -5, script: -5 }, keywords: ['kung fu', 'master', 'tournament', 'dojo', 'revenge'], note: 'Choreography is direction.' },
  { id: 'spy', genre: 'action', name: 'Spy', shift: { script: 10, technical: -5, music: -5 }, keywords: ['spy', 'agent', 'double', 'embassy', 'secret'], note: 'Twists need a tight script.' },
  { id: 'heist', genre: 'action', name: 'Heist', shift: { script: 10, acting: 5, technical: -15 }, keywords: ['heist', 'vault', 'crew', 'casino', 'robbery'], note: 'An ensemble and a clever plan.' },
  { id: 'courtroom', genre: 'drama', name: 'Courtroom', shift: { script: 10, technical: -5, music: -5 }, keywords: ['trial', 'lawyer', 'jury', 'verdict', 'court'], note: 'The closing argument is everything.' },
  { id: 'biopic', genre: 'drama', name: 'Biopic', shift: { acting: 10, script: -5, direction: -5 }, keywords: ['true story', 'life', 'legend', 'rise', 'fall'], note: 'One transformative lead performance.' },
  { id: 'period', genre: 'drama', name: 'Period', shift: { technical: 10, acting: -5, script: -5 }, keywords: ['century', 'estate', 'empire', 'court', 'victorian'], note: 'Costumes and sets sell the era.' },
  { id: 'sports', genre: 'drama', name: 'Sports', shift: { direction: 5, music: 5, script: -10 }, keywords: ['team', 'coach', 'championship', 'underdog', 'season'], note: 'The underdog and the big game.' },
  { id: 'family', genre: 'drama', name: 'Family', shift: { acting: 5, script: 5, technical: -5, music: -5 }, keywords: ['family', 'mother', 'father', 'sister', 'home'], note: 'Small stakes, big feelings.' },
  { id: 'political', genre: 'drama', name: 'Political', shift: { script: 10, music: -5, technical: -5 }, keywords: ['election', 'senator', 'campaign', 'scandal', 'president'], note: 'Sharp dialogue drives it.' },
  { id: 'slapstick', genre: 'comedy', name: 'Slapstick', shift: { direction: 10, technical: 5, script: -15 }, keywords: ['disaster', 'clumsy', 'chaos', 'accident', 'mess'], note: 'Timing and stunts over wit.' },
  { id: 'buddy', genre: 'comedy', name: 'Buddy', shift: { acting: 10, script: -5, music: -5 }, keywords: ['partners', 'road trip', 'odd couple', 'buddy', 'friends'], note: 'The pairing is the movie.' },
  { id: 'parody', genre: 'comedy', name: 'Parody', shift: { script: 10, acting: -5, direction: -5 }, keywords: ['spoof', 'parody', 'mock', 'send-up', 'ridiculous'], note: 'Aim it at whatever is hot right now.' },
  { id: 'teen', genre: 'comedy', name: 'Teen', shift: { music: 5, acting: -5 }, keywords: ['high school', 'prom', 'party', 'summer', 'graduation'], note: 'Young audiences, small budgets.' },
  { id: 'dark-comedy', genre: 'comedy', name: 'Dark comedy', shift: { script: 10, direction: 5, acting: -10, music: -5 }, keywords: ['murder', 'funeral', 'body', 'revenge', 'dinner party'], note: 'Critics love it; audiences are split.' },
  { id: 'workplace', genre: 'comedy', name: 'Workplace', shift: { script: 5, acting: 5, technical: -5, music: -5 }, keywords: ['office', 'boss', 'coworker', 'job', 'promotion'], note: 'Relatable and cheap to shoot.' },
  { id: 'slasher', genre: 'horror', name: 'Slasher', shift: { technical: 5, script: -5 }, keywords: ['killer', 'mask', 'camp', 'knife', 'night'], note: 'Cheap, reliable, sequel-friendly.' },
  { id: 'supernatural', genre: 'horror', name: 'Supernatural', shift: { music: 5, direction: 5, technical: -10 }, keywords: ['ghost', 'haunted', 'demon', 'curse', 'possessed'], note: 'Sound design does the scaring.' },
  { id: 'zombie', genre: 'horror', name: 'Zombie', shift: { technical: 10, acting: -5, music: -5 }, keywords: ['zombie', 'outbreak', 'infected', 'undead', 'survivors'], note: 'Makeup budget matters.' },
  { id: 'creature', genre: 'horror', name: 'Creature', shift: { technical: 15, acting: -5, script: -10 }, keywords: ['creature', 'monster', 'swamp', 'beast', 'lake'], note: 'A bad monster suit sinks it.' },
  { id: 'psychological', genre: 'horror', name: 'Psychological', shift: { script: 10, acting: 10, technical: -15, music: -5 }, keywords: ['mind', 'mirror', 'twin', 'memory', 'paranoia'], note: 'Performance-driven dread.' },
  { id: 'found-footage', genre: 'horror', name: 'Found footage', shift: { technical: -15, direction: 10, acting: 5 }, keywords: ['tape', 'camera', 'footage', 'missing', 'woods'], note: 'Dirt cheap with a huge profit ceiling.' },
  { id: 'space-opera', genre: 'scifi', name: 'Space opera', shift: { technical: 10, music: 5, script: -10, acting: -5 }, keywords: ['empire', 'galaxy', 'starship', 'rebels', 'throne'], note: 'Big score, big ships.' },
  { id: 'alien-invasion', genre: 'scifi', name: 'Alien invasion', shift: { technical: 10, script: -10 }, keywords: ['alien', 'invasion', 'mothership', 'earth', 'contact'], note: 'Spectacle sells.' },
  { id: 'cyberpunk', genre: 'scifi', name: 'Cyberpunk', shift: { direction: 5, music: 5, acting: -10 }, keywords: ['hacker', 'neon', 'corporation', 'implant', 'network'], note: 'Style is substance here.' },
  { id: 'time-travel', genre: 'scifi', name: 'Time travel', shift: { script: 15, technical: -10, music: -5 }, keywords: ['time', 'past', 'future', 'paradox', 'loop'], note: 'Plot holes get noticed.' },
  { id: 'post-apocalyptic', genre: 'scifi', name: 'Post-apocalyptic', shift: { direction: 5, acting: 5, technical: -5, script: -5 }, keywords: ['wasteland', 'survivor', 'ruins', 'after', 'last'], note: 'Bleak but beloved.' },
  { id: 'robots-ai', genre: 'scifi', name: 'Robots and AI', shift: { script: 10, acting: 5, technical: -10, music: -5 }, keywords: ['robot', 'android', 'ai', 'machine', 'conscious'], note: 'The big question carries it.' },
  { id: 'romcom', genre: 'romance', name: 'Romantic comedy', shift: { script: 5, acting: 5, music: -5, direction: -5 }, keywords: ['wedding', 'date', 'bet', 'roommate', 'fake'], note: 'Chemistry plus jokes.' },
  { id: 'period-romance', genre: 'romance', name: 'Period romance', shift: { technical: 10, script: -5, acting: -5 }, keywords: ['duke', 'estate', 'ball', 'letters', 'governess'], note: 'Costumes and longing.' },
  { id: 'tearjerker', genre: 'romance', name: 'Tearjerker', shift: { acting: 5, music: 5, technical: -5, direction: -5 }, keywords: ['illness', 'letter', 'goodbye', 'last summer', 'promise'], note: 'Bring tissues, win awards.' },
  { id: 'teen-romance', genre: 'romance', name: 'Teen romance', shift: { music: 5, acting: -5 }, keywords: ['prom', 'crush', 'summer', 'first love', 'school'], note: 'Young stars, young audience.' },
  { id: 'holiday-romance', genre: 'romance', name: 'Holiday romance', shift: { music: 5, script: -5 }, keywords: ['christmas', 'snow', 'holiday', 'small town', 'inn'], note: 'Release it in December or don’t bother.' },
]

export const subgenreById = (id: string | undefined) => SUBGENRES.find((s) => s.id === id)

export type Critic = {
  id: string
  name: string
  outlet: string
  persona: string
  bias: Partial<Record<GenreId, number>>
  parodyFan?: boolean
  harsh: number // shifts the average score
}

export const CRITICS: Critic[] = [
  { id: 'vale', name: 'Margot Vale', outlet: 'The Evening Ledger', persona: 'the snob', bias: { drama: 8, action: -8, comedy: -4 }, harsh: -6 },
  { id: 'dukes', name: 'Benny Dukes', outlet: 'Channel 9 Movie Minute', persona: 'the populist', bias: { action: 8, comedy: 6, drama: -4 }, harsh: 6 },
  { id: 'crow', name: 'Ravenna Crow', outlet: 'Gorehound Monthly', persona: 'the gore-hound', bias: { horror: 15, romance: -10 }, harsh: 0 },
  { id: 'ostrowski', name: 'Pete Ostrowski', outlet: 'Reel Talk Weekly', persona: 'the parody superfan', bias: { comedy: 6 }, parodyFan: true, harsh: 2 },
  { id: 'lin', name: 'Dana Lin', outlet: 'Frame Rate', persona: 'the sci-fi nerd', bias: { scifi: 12, romance: -4 }, harsh: -2 },
]

export const FIRST_NAMES = [
  'Ava', 'Ben', 'Cora', 'Dex', 'Elena', 'Felix', 'Gwen', 'Hank', 'Iris', 'Jules', 'Kit', 'Lena', 'Marco', 'Nina', 'Otis',
  'Priya', 'Quinn', 'Rosa', 'Sam', 'Tess', 'Umar', 'Vera', 'Wes', 'Xena', 'Yusuf', 'Zoe', 'Abel', 'Bea', 'Cyrus', 'Dahlia',
  'Emmett', 'Fern', 'Gus', 'Hazel', 'Ivo', 'June', 'Kai', 'Lola', 'Milo', 'Nadia', 'Oscar', 'Paz', 'Rex', 'Sunny', 'Theo',
]

export const LAST_NAMES = [
  'Ashford', 'Blake', 'Castellano', 'Drummond', 'Ellery', 'Fairbanks', 'Grady', 'Holloway', 'Ibarra', 'Jansen', 'Kowalski',
  'Lockhart', 'Mercer', 'Nakamura', 'Okafor', 'Pembrook', 'Quill', 'Rourke', 'Sato', 'Thorne', 'Underhill', 'Valdez',
  'Whitlock', 'Yates', 'Zeller', 'Banerjee', 'Carver', 'Delacroix', 'Esposito', 'Finch', 'Galloway', 'Hart', 'Ivers',
]

export const RIVAL_STUDIOS = ['Paragon Pictures', 'Monolith Films', 'Starlight Studios', 'Crescent Media', 'Ironbridge Entertainment']

export const RIVAL_TITLE_A = ['Midnight', 'Iron', 'Silent', 'Crimson', 'Last', 'Broken', 'Golden', 'Wild', 'Hidden', 'Final']
export const RIVAL_TITLE_B = ['Horizon', 'Protocol', 'Summer', 'Echo', 'Kingdom', 'Signal', 'Run', 'Heart', 'Storm', 'Hour']

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const START_YEAR = 2000
export const CAMPAIGN_YEARS = 30
export const START_CASH = 1_000_000
export const WEEKLY_OVERHEAD = 4_000
