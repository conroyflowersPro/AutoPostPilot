/**
 * Daily Topic Spacing after weekly selection.
 * Does NOT change weekly interest totals or invent seeds.
 * Only reorders/swaps day placement of already-selected slots.
 */

export type PlaceableSlot = {
  topic_cluster?: string;
  cluster?: string;
  concrete_subject?: string;
  primaryTopic?: string;
  editorial_mode?: string;
  [k: string]: unknown;
};

function clusterOf(s: PlaceableSlot): string {
  return String(s.topic_cluster || s.cluster || "GENERAL").toUpperCase();
}

function dayTopicCounts(day: PlaceableSlot[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of day) {
    const c = clusterOf(s);
    m.set(c, (m.get(c) || 0) + 1);
  }
  return m;
}

/**
 * Soft max same primary topic per day.
 * ORDER 2: tighter than 50% — 6 posts → softCap via max(2, ceil(n*0.4))
 */
export function softDailyCap(postsPerDay: number): number {
  return Math.max(2, Math.ceil(postsPerDay * 0.4));
}

/**
 * Greedy swap: if day A is overloaded on topic T and day B is light on T and has a swap candidate,
 * swap to reduce concentration. Preserves all slots (no drop).
 */
export function redistributeDailyTopics<T extends PlaceableSlot>(
  days: Array<{ dayOffset: number; posts: T[] }>,
  postsPerDay: number
): {
  days: Array<{ dayOffset: number; posts: T[] }>;
  swaps: number;
  max_daily_topic: number;
  consecutive_same_topic_pairs: number;
} {
  const softCap = softDailyCap(postsPerDay);
  let swaps = 0;
  const daysCopy = days.map((d) => ({
    dayOffset: d.dayOffset,
    posts: [...d.posts],
  }));

  for (let pass = 0; pass < 4; pass++) {
    let passSwaps = 0;
    for (let di = 0; di < daysCopy.length; di++) {
      const counts = dayTopicCounts(daysCopy[di].posts);
      for (const [topic, n] of counts) {
        if (n <= softCap) continue;
        for (let si = 0; si < daysCopy[di].posts.length; si++) {
          if (clusterOf(daysCopy[di].posts[si]) !== topic) continue;
          let best: { dj: number; sj: number; score: number } | null = null;
          for (let dj = 0; dj < daysCopy.length; dj++) {
            if (dj === di) continue;
            const otherCounts = dayTopicCounts(daysCopy[dj].posts);
            const otherN = otherCounts.get(topic) || 0;
            if (otherN >= softCap) continue;
            for (let sj = 0; sj < daysCopy[dj].posts.length; sj++) {
              const otherTopic = clusterOf(daysCopy[dj].posts[sj]);
              if (otherTopic === topic) continue;
              const diOther = (counts.get(otherTopic) || 0) + 1;
              const djTopic = otherN + 1;
              const score =
                n - 1 +
                djTopic +
                (diOther > softCap ? 2 : 0);
              if (!best || score < best.score) {
                best = { dj, sj, score };
              }
            }
          }
          if (best) {
            const tmp = daysCopy[di].posts[si];
            daysCopy[di].posts[si] = daysCopy[best.dj].posts[best.sj];
            daysCopy[best.dj].posts[best.sj] = tmp;
            passSwaps++;
            swaps++;
            break;
          }
        }
      }
    }
    if (passSwaps === 0) break;
  }

  for (const d of daysCopy) {
    for (let i = 0; i < d.posts.length - 1; i++) {
      if (clusterOf(d.posts[i]) !== clusterOf(d.posts[i + 1])) continue;
      for (let j = i + 2; j < d.posts.length; j++) {
        if (clusterOf(d.posts[j]) === clusterOf(d.posts[i])) continue;
        const t = d.posts[i + 1];
        d.posts[i + 1] = d.posts[j];
        d.posts[j] = t;
        swaps++;
        break;
      }
    }
  }

  let maxDaily = 0;
  let consec = 0;
  for (const d of daysCopy) {
    const c = dayTopicCounts(d.posts);
    for (const n of c.values()) maxDaily = Math.max(maxDaily, n);
    for (let i = 0; i < d.posts.length - 1; i++) {
      if (clusterOf(d.posts[i]) === clusterOf(d.posts[i + 1])) consec++;
    }
  }

  return {
    days: daysCopy,
    swaps,
    max_daily_topic: maxDaily,
    consecutive_same_topic_pairs: consec,
  };
}

export function topicDistributionReport(
  days: Array<{ dayOffset: number; posts: PlaceableSlot[] }>
): Array<{ day: number; counts: Record<string, number>; dominant?: string }> {
  return days.map((d) => {
    const counts: Record<string, number> = {};
    for (const p of d.posts) {
      const c = clusterOf(p);
      counts[c] = (counts[c] || 0) + 1;
    }
    let dominant: string | undefined;
    let max = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > max) {
        max = v;
        dominant = k;
      }
    }
    return { day: d.dayOffset + 1, counts, dominant };
  });
}
