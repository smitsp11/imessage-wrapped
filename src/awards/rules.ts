import { formatMinutes, percent } from '../format'
import type { ReactionStats } from '../stats/reactions'
import type { ReplyStats } from '../stats/replies'
import type { StarterStats } from '../stats/starters'
import type { TimingStats } from '../stats/timing'
import type { VolumeStats } from '../stats/volume'
import type { Award, AwardId } from '../types'

/** Nobody wins anything on a handful of texts. */
export const MIN_MESSAGES_FOR_AWARD = 50
/** A median over a couple of replies says nothing, so The Ghost also needs this many replies. */
export const MIN_REPLIES_FOR_GHOST = 10
/** A "slowest replier" who answers within the hour isn't a ghost. */
export const GHOST_MIN_MINUTES = 60
/** Starter, Double Texter and Hype Man need at least this many to count. */
export const MIN_COUNT_AWARD = 3
/** The Comedian needs at least this many laughs per 100 messages. */
export const COMEDIAN_MIN_PER_100 = 1
/** Night Owl needs at least this share of messages sent 12-5 AM. */
export const NIGHT_OWL_MIN_SHARE = 0.1
/** The Lurker must be under this fraction of an even split. */
export const LURKER_MAX_OF_EVEN_SPLIT = 0.5

export type AwardInputs = {
  volume: VolumeStats
  timing: TimingStats
  replies: ReplyStats
  starters: StarterStats
  reactions: ReactionStats
}

type Rule = {
  id: AwardId
  title: string
  pick: 'max' | 'min'
  /** The raw number compared between people (unrounded). */
  raw: (person: string, s: AwardInputs) => number | undefined
  /** The winner's raw number must reach this (max) or stay under it (min). */
  threshold: (qualifiers: number) => number
  /** The number shown on the slide. */
  display: (raw: number) => number
  label: (value: number) => string
  minPeople?: number
  /** Skipped in solo wraps. */
  groupOnly?: boolean
}

const share = (person: string, s: AwardInputs) => (s.volume.byPerson[person] ?? 0) / s.volume.total

/** The Ghost's median only counts with enough replies behind it. */
function ghostMinutes(person: string, s: AwardInputs): number | undefined {
  const enough = (s.replies.repliesByPerson[person] ?? 0) >= MIN_REPLIES_FOR_GHOST
  return enough ? s.replies.medianReplyMinutesByPerson[person] : undefined
}

const RULES: Rule[] = [
  {
    id: 'main-character', title: 'Main Character', pick: 'max', groupOnly: true,
    raw: share, threshold: () => 0, display: percent,
    label: (v) => `${v}% of all messages`,
  },
  {
    id: 'ghost', title: 'The Ghost', pick: 'max',
    raw: ghostMinutes, threshold: () => GHOST_MIN_MINUTES, display: (r) => r,
    label: (v) => `median reply ${formatMinutes(v)}`,
  },
  {
    id: 'starter', title: 'The Starter', pick: 'max',
    raw: (p, s) => s.starters.startsByPerson[p] ?? 0, threshold: () => MIN_COUNT_AWARD, display: (r) => r,
    label: (v) => `started ${v} conversations`,
  },
  {
    id: 'comedian', title: 'The Comedian', pick: 'max',
    raw: (p, s) => (s.reactions.laughsReceivedByPerson[p] ?? 0) / (s.volume.byPerson[p] as number),
    threshold: () => COMEDIAN_MIN_PER_100 / 100, display: percent,
    label: (v) => `${v} ${v === 1 ? 'laugh' : 'laughs'} per 100 messages`,
  },
  {
    id: 'hype', title: 'Hype Man', pick: 'max',
    raw: (p, s) => s.reactions.givenByPerson[p] ?? 0, threshold: () => MIN_COUNT_AWARD, display: (r) => r,
    label: (v) => `gave ${v} reactions`,
  },
  {
    id: 'night-owl', title: 'Night Owl', pick: 'max',
    raw: (p, s) => s.timing.lateNightShareByPerson[p] ?? 0, threshold: () => NIGHT_OWL_MIN_SHARE, display: percent,
    label: (v) => `${v}% of messages sent 12–5 AM`,
  },
  {
    id: 'double-texter', title: 'Double Texter', pick: 'max',
    raw: (p, s) => s.starters.doubleTextsByPerson[p] ?? 0, threshold: () => MIN_COUNT_AWARD, display: (r) => r,
    label: (v) => `${v} double texts`,
  },
  {
    id: 'lurker', title: 'The Lurker', pick: 'min', minPeople: 3, groupOnly: true,
    raw: share, threshold: (n) => LURKER_MAX_OF_EVEN_SPLIT / n, display: percent,
    label: (v) => `only ${v}% of messages`,
  },
]

/**
 * Every award comes from one number, compared unrounded, and goes to a unique winner who clears the rule's threshold.
 * A tie for the best number means no award. Solo wraps skip Main Character and The Lurker: you are in every chat,
 * and "lurker" across all your chats isn't true of anyone.
 */
export function pickAwards(stats: AwardInputs, mode: 'group' | 'solo' = 'group'): Award[] {
  // sorted only so the output is deterministic
  const people = Object.keys(stats.volume.byPerson)
    .filter((p) => (stats.volume.byPerson[p] ?? 0) >= MIN_MESSAGES_FOR_AWARD)
    .sort()

  const awards: Award[] = []
  for (const rule of RULES) {
    if (mode === 'solo' && rule.groupOnly) continue
    if (people.length < (rule.minPeople ?? 1)) continue

    const scored: { person: string; raw: number }[] = []
    for (const person of people) {
      const raw = rule.raw(person, stats)
      if (raw !== undefined) scored.push({ person, raw })
    }
    if (scored.length === 0) continue

    const bestRaw = (rule.pick === 'max' ? Math.max : Math.min)(...scored.map((c) => c.raw))
    const winners = scored.filter((c) => c.raw === bestRaw)
    const winner = winners[0]
    if (winners.length !== 1 || !winner) continue

    const threshold = rule.threshold(people.length)
    const clears = rule.pick === 'max' ? bestRaw > 0 && bestRaw >= threshold : bestRaw < threshold
    if (!clears) continue

    const value = rule.display(bestRaw)
    awards.push({ id: rule.id, title: rule.title, personId: winner.person, value, label: rule.label(value) })
  }
  return awards
}
