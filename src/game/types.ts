import type { Dept, GenreId } from './data'
import type { RunState } from './theaters'

export type Role = 'actor' | 'director' | 'composer'

export type Talent = {
  id: string
  name: string
  role: Role
  age: number
  skill: number // 0..100
  star: number // 0..100
  genreFit: Record<GenreId, number> // 0..100
  temperament: number // 0..100, higher = more trouble
  relationship: number // -100..100 with the player's studio
  hue: number // portrait colour
  potential?: number // hidden ceiling for star power; rookies with high potential break out
  debut?: number // year they joined the roster
  prevStar?: number // star power a year ago, for rising/fading arrows
  retired?: boolean
  source?: 'imdb' // a real person from the player's talent pack
}

export type ScriptOffer = {
  id: string
  writer: string
  source: 'self' | 'spec' | 'commission'
  quality: number // hidden
  coverage: string // fuzzy grade shown to the player
  cost: number
}

export type EventChoice = {
  label: string
  cost: number
  quality: number
  note: string
  hype?: number // audience reaction to the story
  delay?: number // weeks lost
  rep?: number // studio reputation
  relLead?: number // how the lead feels about you
  relDirector?: number
  relAll?: number // word gets around to every actor and director
  backerRel?: number
  recastWith?: string // replacement lead's id
  replaceDirector?: string
  aftermath?: string // line for the post-release breakdown
}
export type ProductionEvent = {
  key?: string
  kills?: string // talent id of someone who dies in this event
  week: number
  title: string
  text: string
  choices: EventChoice[]
  chosen?: number
}

export type Bid = { backer: string; cap: number; share: number; blurb: string; reason?: string }
export type Financing = Bid & { used: number }

export type Marketing = { tv: number; print: number; web: number; trailer: number }

export type ReleasePlan = { monthOffset: number; screens: number }

export type Review = { critic: string; outlet: string; persona: string; stars: number; quote: string }

export type FilmResult = {
  quality: number
  deptScores: Record<Dept, number>
  hype: number
  opening: number
  weekly: number[]
  domestic: number
  ancillary: number
  studioRevenue: number
  totalCost: number
  profit: number
  funded: number // costs the backer paid
  partnerCut: number // backer's share of revenue
  reviews: Review[]
  criticScore: number // 0..100
  peakScreens: number
  reception: number // audience luck: <1 cold, >1 warm
  headline: string
  breakdown: string[]
  releaseYear: number
  releaseMonth: number
}

export type Film = {
  id: string
  seed: number
  title: string
  logline: string
  genre: GenreId
  subgenre?: string
  parodyTarget?: string
  financing?: Financing
  posterId?: string // player-uploaded poster
  hypeBonus?: number // from production stories (scandals, tributes, leaks)
  script?: ScriptOffer
  directorId?: string
  leadIds: string[]
  supportIds: string[]
  composerId?: string
  techBudget: number
  musicBudget: number
  shootWeeks: number
  events: ProductionEvent[]
  reshoot: boolean
  testScore?: string
  marketing: Marketing
  release: ReleasePlan
  costs: { script: number; talent: number; production: number; events: number; post: number; marketing: number; prints: number }
  run?: RunState // the theatrical run while it's playing
  result?: FilmResult
  stage: 'pitch' | 'financing' | 'script' | 'cast' | 'budget' | 'production' | 'post' | 'release' | 'theaters' | 'results' | 'done'
}

export type Studio = {
  name: string
  owner: string
  id: string // public Studio ID
  key: string // secret Studio Key
  tag: string // 4-digit display tag
  recovery: string
  logoId?: string
}

export type Game = {
  version: 1
  seed: number
  studio: Studio
  cash: number
  debt: number
  week: number // weeks since campaign start
  reputation: number // 0..100
  talent: Talent[]
  trends: Record<string, number> // by subgenre id, 0.5..1.6
  prevTrends?: Record<string, number> // last year's, for trend news
  hotKeyword: string
  films: Film[]
  current?: Film
  lastPostedAt?: number
  bankrupt?: boolean
  talentSource?: 'fictional' | 'imdb'
  backerRel?: Record<string, number> // how each backer feels about you after past deals
}
