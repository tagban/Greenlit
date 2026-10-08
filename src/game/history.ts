// Genre popularity from real box-office history, 2000–2025 (approximate, hand-compiled
// from well-known hits and slumps). Values are audience appetite: 1 = normal, 1.5 = boom,
// 0.6 = dead. Years between keyframes are interpolated; after the last keyframe the game
// drifts on its own. These describe genres, not people, so they ship with the public game.

export const HISTORY: Record<string, [number, number][]> = {
  police: [[2000, 1.0], [2001, 1.25], [2003, 1.15], [2008, 0.95], [2012, 0.9], [2020, 0.85], [2024, 1.05]], // Training Day; Bad Boys revival
  'military-hist': [[2000, 1.1], [2001, 1.3], [2004, 1.0], [2010, 0.9], [2017, 1.3], [2019, 1.25], [2022, 1.05]], // Pearl Harbor; Dunkirk, 1917
  'military-modern': [[2000, 0.9], [2002, 1.15], [2006, 0.9], [2009, 1.15], [2012, 1.25], [2014, 1.45], [2016, 1.0], [2022, 1.2]], // Black Hawk Down; American Sniper; Top Gun: Maverick
  superhero: [[2000, 1.05], [2002, 1.3], [2004, 1.25], [2006, 1.1], [2008, 1.45], [2012, 1.6], [2015, 1.6], [2019, 1.65], [2021, 1.4], [2023, 1.0], [2025, 0.9]], // Spider-Man to Endgame, then fatigue
  'martial-arts': [[2000, 1.35], [2003, 1.3], [2004, 1.2], [2008, 1.0], [2012, 0.85], [2014, 1.1], [2019, 1.15], [2023, 1.1]], // Crouching Tiger, Kill Bill; John Wick
  spy: [[2000, 1.05], [2002, 1.25], [2006, 1.4], [2008, 1.2], [2012, 1.3], [2015, 1.3], [2018, 1.05], [2021, 1.0], [2023, 0.9]], // Bourne, Casino Royale, Skyfall
  heist: [[2000, 1.0], [2001, 1.35], [2003, 1.2], [2004, 1.1], [2010, 1.1], [2013, 1.15], [2015, 1.25], [2018, 1.0], [2023, 0.9]], // Ocean's Eleven; Inception; Fast & Furious
  courtroom: [[2000, 1.0], [2005, 0.9], [2010, 0.8], [2020, 0.75], [2024, 0.85]],
  biopic: [[2000, 1.0], [2004, 1.25], [2005, 1.3], [2010, 1.1], [2014, 1.2], [2018, 1.4], [2019, 1.3], [2022, 1.2], [2023, 1.45], [2025, 1.15]], // Ray, Walk the Line; Bohemian Rhapsody; Oppenheimer
  period: [[2000, 1.25], [2003, 1.2], [2005, 1.15], [2010, 1.05], [2013, 1.1], [2018, 0.9], [2024, 0.95]], // Gladiator, Master and Commander
  sports: [[2000, 1.25], [2004, 1.2], [2006, 1.15], [2009, 1.35], [2011, 1.2], [2015, 1.15], [2020, 0.85], [2023, 1.0]], // Remember the Titans; The Blind Side; Moneyball
  family: [[2000, 1.0], [2006, 1.1], [2008, 1.05], [2012, 0.95], [2017, 1.1], [2021, 1.0]],
  political: [[2000, 0.95], [2005, 1.0], [2012, 1.2], [2015, 1.0], [2020, 0.85]], // Lincoln, Argo
  slapstick: [[2000, 1.3], [2004, 1.15], [2006, 1.05], [2010, 0.85], [2015, 0.75], [2022, 0.7]], // Jim Carrey era fades
  buddy: [[2000, 1.15], [2003, 1.2], [2005, 1.3], [2009, 1.35], [2012, 1.2], [2014, 1.3], [2017, 1.0], [2023, 0.9]], // Wedding Crashers, The Hangover, 22 Jump Street
  parody: [[2000, 1.55], [2001, 1.4], [2003, 1.35], [2006, 1.1], [2008, 0.85], [2010, 0.6], [2015, 0.55], [2023, 0.6]], // Scary Movie, then the Epic Movie crash
  teen: [[2000, 1.2], [2001, 1.35], [2004, 1.2], [2007, 1.4], [2010, 1.1], [2015, 0.9], [2023, 0.85]], // American Pie 2, Mean Girls, Superbad
  'dark-comedy': [[2000, 0.95], [2004, 1.0], [2009, 1.05], [2014, 1.1], [2019, 1.3], [2022, 1.3], [2025, 1.1]], // Knives Out, The Menu
  workplace: [[2000, 1.0], [2006, 1.2], [2011, 1.25], [2015, 0.95], [2022, 0.8]], // The Devil Wears Prada, Horrible Bosses
  slasher: [[2000, 1.05], [2003, 1.1], [2006, 1.0], [2009, 1.15], [2012, 0.85], [2018, 1.35], [2021, 1.2], [2022, 1.3], [2025, 1.0]], // remake wave; Halloween, Scream returns
  supernatural: [[2000, 1.2], [2002, 1.3], [2005, 1.05], [2009, 1.1], [2013, 1.45], [2016, 1.35], [2019, 1.2], [2023, 1.15]], // The Ring; The Conjuring universe
  zombie: [[2000, 0.85], [2002, 1.15], [2004, 1.3], [2007, 1.2], [2009, 1.25], [2013, 1.45], [2016, 1.0], [2020, 0.85], [2025, 1.05]], // 28 Days Later, Dawn of the Dead, World War Z
  creature: [[2000, 0.9], [2005, 1.1], [2008, 1.15], [2014, 1.3], [2017, 1.2], [2021, 1.15], [2024, 1.25]], // Cloverfield; MonsterVerse
  psychological: [[2000, 1.1], [2004, 1.0], [2010, 1.15], [2014, 1.1], [2017, 1.45], [2019, 1.35], [2022, 1.25]], // Black Swan; Get Out, Us
  'found-footage': [[2000, 1.15], [2002, 0.8], [2007, 1.0], [2008, 1.2], [2009, 1.55], [2011, 1.35], [2013, 1.0], [2015, 0.7], [2022, 0.65]], // Paranormal Activity boom and bust
  'space-opera': [[2000, 1.0], [2002, 1.2], [2005, 1.3], [2009, 1.4], [2012, 1.1], [2014, 1.35], [2015, 1.6], [2017, 1.5], [2019, 1.25], [2021, 1.2], [2024, 1.3]], // Star Wars; Avatar; Guardians; Dune
  'alien-invasion': [[2000, 1.0], [2002, 1.15], [2005, 1.3], [2009, 1.25], [2011, 1.05], [2012, 1.2], [2016, 0.9], [2022, 0.95]], // Signs, War of the Worlds; Avengers
  cyberpunk: [[2000, 1.25], [2003, 1.35], [2005, 1.0], [2010, 1.05], [2017, 0.75], [2021, 0.85]], // Matrix sequels; Ghost in the Shell and Blade Runner 2049 disappoint
  'time-travel': [[2000, 1.0], [2004, 1.05], [2009, 1.15], [2012, 1.2], [2014, 1.25], [2020, 1.15], [2023, 1.1]], // Looper, Interstellar, Tenet
  'post-apocalyptic': [[2000, 0.9], [2004, 1.1], [2007, 1.2], [2010, 1.15], [2012, 1.45], [2015, 1.4], [2018, 1.2], [2023, 1.05]], // I Am Legend; Hunger Games; Mad Max: Fury Road
  'robots-ai': [[2000, 1.0], [2001, 1.1], [2004, 1.2], [2007, 1.45], [2011, 1.35], [2015, 1.2], [2018, 1.0], [2023, 1.15]], // I, Robot; Transformers; Ex Machina
  romcom: [[2000, 1.35], [2002, 1.4], [2004, 1.3], [2009, 1.1], [2012, 0.9], [2016, 0.75], [2018, 1.15], [2023, 1.1]], // golden age, slump, Crazy Rich Asians, Anyone But You
  'period-romance': [[2000, 1.05], [2005, 1.3], [2007, 1.2], [2012, 1.0], [2017, 0.9], [2022, 1.0]], // Pride & Prejudice, Atonement
  tearjerker: [[2000, 1.1], [2004, 1.4], [2006, 1.2], [2010, 1.25], [2014, 1.35], [2016, 1.15], [2020, 0.85]], // The Notebook; The Fault in Our Stars
  'teen-romance': [[2000, 1.05], [2002, 1.15], [2008, 1.5], [2010, 1.55], [2012, 1.45], [2014, 1.3], [2017, 1.0], [2021, 0.85]], // Twilight saga
  'holiday-romance': [[2000, 1.0], [2003, 1.4], [2006, 1.3], [2010, 1.05], [2015, 0.9], [2020, 1.0]], // Love Actually, The Holiday
}

export function historicTrend(id: string, year: number): number | undefined {
  const keys = HISTORY[id]
  if (!keys || year < keys[0][0] || year > keys[keys.length - 1][0]) return undefined
  for (let i = 0; i < keys.length - 1; i++) {
    const [y0, v0] = keys[i]
    const [y1, v1] = keys[i + 1]
    if (year >= y0 && year <= y1) return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0)
  }
  return keys[keys.length - 1][1]
}
