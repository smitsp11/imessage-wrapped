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
  value: (person: string, s: AwardInputs) => number | undefined
  label: (value: number) => string
  minPeople?: number
}

const share = (person: string, s: AwardInputs) => percent((s.volume.byPerson[person] ?? 0) / s.volume.total)

const RULES: Rule[] = [
  { id: 'main-character', title: 'Main Character', pick: 'max', value: share, label: (v) => `${v}% of all messages` },
  {
    id: 'ghost', title: 'The Ghost', pick: 'max',
    value: (p, s) =>
      (s.replies.repliesByPerson[p] ?? 0) >= MIN_REPLIES_FOR_GHOST ? s.replies.medianReplyMinutesByPerson[p] : undefined,
    label: (v) => `median reply ${formatMinutes(v)}`,
  },
  {
    id: 'starter', title: 'The Starter', pick: 'max',
    value: (p, s) => s.starters.startsByPerson[p] ?? 0,
    label: (v) => `started ${v} conversations`,
  },
  {
    id: 'comedian', title: 'The Comedian', pick: 'max',
    value: (p, s) => Math.round(((s.reactions.laughsReceivedByPerson[p] ?? 0) / (s.volume.byPerson[p] ?? 1)) * 1000) / 10,
    label: (v) => `${v} laughs per 100 messages`,
  },
  {
    id: 'hype', title: 'Hype Man', pick: 'max',
    value: (p, s) => s.reactions.givenByPerson[p] ?? 0,
    label: (v) => `gave ${v} reactions`,
  },
  {
    id: 'night-owl', title: 'Night Owl', pick: 'max',
    value: (p, s) => percent(s.timing.lateNightShareByPerson[p] ?? 0),
    label: (v) => `${v}% of messages sent 12–5 AM`,
  },
  {
    id: 'double-texter', title: 'Double Texter', pick: 'max',
    value: (p, s) => s.starters.doubleTextsByPerson[p] ?? 0,
    label: (v) => `${v} double texts`,
  },
  { id: 'lurker', title: 'The Lurker', pick: 'min', minPeople: 3, value: share, label: (v) => `only ${v}% of messages` },
]

/** Every award comes from one number. Ties go to the first person id alphabetically. */
export function pickAwards(stats: AwardInputs): Award[] {
  const people = Object.keys(stats.volume.byPerson)
    .filter((p) => (stats.volume.byPerson[p] ?? 0) >= MIN_MESSAGES_FOR_AWARD)
    .sort()

  const awards: Award[] = []
  for (const rule of RULES) {
    if (people.length < (rule.minPeople ?? 1)) continue
    let best: { person: string; value: number } | null = null
    for (const person of people) {
      const value = rule.value(person, stats)
      if (value === undefined || (rule.pick === 'max' && value <= 0)) continue
      const better = rule.pick === 'max' ? value > (best?.value ?? -Infinity) : value < (best?.value ?? Infinity)
      if (better) best = { person, value }
    }
    if (best) awards.push({ id: rule.id, title: rule.title, personId: best.person, value: best.value, label: rule.label(best.value) })
  }
  return awards
}
