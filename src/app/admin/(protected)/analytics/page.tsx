import Link from "next/link";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/auth";
import { completionRate } from "@/lib/analytics/events";
import { sponsorCtr } from "@/lib/sponsorship/selection";
import { analyticsHealthStatus, excludeTestEvents, feedbackMetrics, filterFeedback, type FeedbackFilters } from "@/lib/feedback/analytics";
import { feedbackCategories, satisfactionFromRating } from "@/lib/feedback/validation";
import { sentimentProviderConfigured } from "@/lib/feedback/sentiment";
import type { DbFeedbackSubmission, FeedbackCategory, SentimentLabel } from "@/types/database";
import { analysePendingFeedbackAction, overrideSentimentAction, reanalyseFeedbackAction, sendTestAnalyticsEventAction, sendTestPresenceAction } from "./actions";
import { aggregateActiveListeners } from "@/lib/presence/validation";

type Search = Record<string, string | string[] | undefined>;
const sentimentLabels: SentimentLabel[] = ["positive", "neutral", "negative", "mixed"];
const categoryNames: Record<FeedbackCategory, string> = {
  music_selection: "Music selection", playback: "Playback", channel_experience: "Channel experience",
  design: "Design", performance: "Performance", other: "Other",
};

function value(search: Search, key: string) {
  const found = search[key];
  return Array.isArray(found) ? found[0] : found ?? "";
}
function percent(amount: number) { return `${amount.toFixed(1)}%`; }
function shortDate(date: string | null) {
  return date ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(date)) : "No data";
}

function Distribution({ title, entries, total }: { title: string; entries: [string, number][]; total: number }) {
  return <section className="rounded-lg border border-white/10 bg-white/5 p-4"><h3 className="font-black">{title}</h3><div className="mt-4 space-y-3">{entries.map(([label, count]) => <div key={label}><div className="flex justify-between text-xs"><span>{label}</span><span className="tabular-nums text-white/60">{count}</span></div><div className="mt-1 h-2 overflow-hidden rounded-sm bg-white/10"><div className="h-full bg-emerald-300" style={{ width: `${total ? Math.max(2, count / total * 100) : 0}%` }} /></div></div>)}</div></section>;
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const context = await getAdminContext();
  const supabase = createServiceSupabaseClient();
  const canReadFeedback = context.status === "ok" && context.profile.role === "admin";
  const [channelMetrics, sponsorMetrics, channelResult, songResult, feedbackResult, eventResult, presenceResult] = await Promise.all([
    supabase?.from("daily_channel_metrics").select("*").order("metric_date_ist", { ascending: false }).limit(180),
    supabase?.from("daily_sponsor_metrics").select("*").order("metric_date_ist", { ascending: false }).limit(180),
    supabase?.from("channels").select("id, name, primary_language_code, channel_mode"),
    canReadFeedback ? supabase?.from("songs").select("id, title").order("title").limit(2000) : null,
    canReadFeedback ? supabase?.from("feedback_submissions").select("*").order("created_at", { ascending: false }).limit(5000) : null,
    canReadFeedback ? supabase?.from("listening_events").select("*").order("created_at", { ascending: false }).limit(1000) : null,
    canReadFeedback ? supabase?.from("active_listener_sessions").select("channel_id, player_state, last_seen_at, expires_at, is_test, heartbeat_window_started_at, heartbeat_count").order("last_seen_at", { ascending: false }).limit(5000) : null,
  ]);

  const rows = channelMetrics?.data ?? [];
  const sponsorRows = sponsorMetrics?.data ?? [];
  const channels = channelResult?.data ?? [];
  const songs = songResult?.data ?? [];
  const channelName = new Map(channels.map((channel) => [channel.id, channel.name]));
  const channelMetadata = new Map(channels.map((channel) => [channel.id, channel]));
  const songName = new Map(songs.map((song) => [song.id, song.title]));
  const allFeedback = (feedbackResult?.data ?? []) as DbFeedbackSubmission[];
  const filters: FeedbackFilters = {
    from: value(search, "from") || undefined, to: value(search, "to") || undefined,
    rating: Number(value(search, "rating")) || undefined,
    sentiment: sentimentLabels.includes(value(search, "sentiment") as SentimentLabel) ? value(search, "sentiment") as SentimentLabel : undefined,
    category: feedbackCategories.includes(value(search, "category") as FeedbackCategory) ? value(search, "category") as FeedbackCategory : undefined,
    channelId: value(search, "channel") || undefined, songId: value(search, "song") || undefined,
  };
  const feedback = filterFeedback(allFeedback, filters);
  const metrics = feedbackMetrics(feedback);
  const countBy = (get: (row: DbFeedbackSubmission) => string) => feedback.reduce<Record<string, number>>((acc, row) => { const key = get(row); acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
  const ratings = countBy((row) => String(row.rating));
  const sentiments = countBy((row) => row.admin_sentiment_override ?? row.sentiment_label ?? "Unanalysed");
  const categories = countBy((row) => row.category ? categoryNames[row.category] : "Uncategorised");
  const dates = countBy((row) => row.created_at.slice(0, 10));
  const themes = feedback.flatMap((row) => row.detected_themes ?? []).reduce<Record<string, number>>((acc, theme) => { acc[theme] = (acc[theme] ?? 0) + 1; return acc; }, {});
  const totals = rows.reduce((acc, row) => ({ sessions: acc.sessions + row.listening_sessions, unique: acc.unique + row.unique_anonymous_sessions, seconds: acc.seconds + Number(row.listening_seconds), started: acc.started + row.songs_started, completed: acc.completed + row.songs_completed, skips: acc.skips + row.skips, errors: acc.errors + row.player_errors, shares: acc.shares + row.shares }), { sessions: 0, unique: 0, seconds: 0, started: 0, completed: 0, skips: 0, errors: 0, shares: 0 });
  const sessionsByLanguage = rows.reduce<Record<string, number>>((acc, row) => { const key = channelMetadata.get(row.channel_id)?.primary_language_code ?? "unclassified"; acc[key] = (acc[key] ?? 0) + row.listening_sessions; return acc; }, {});
  const sessionsByMode = rows.reduce<Record<string, number>>((acc, row) => { const key = channelMetadata.get(row.channel_id)?.channel_mode ?? "unclassified"; acc[key] = (acc[key] ?? 0) + row.listening_sessions; return acc; }, {});
  const sponsorTotals = sponsorRows.reduce((acc, row) => ({ impressions: acc.impressions + row.impressions, clicks: acc.clicks + row.clicks }), { impressions: 0, clicks: 0 });
  const events = excludeTestEvents(eventResult?.data ?? []);
  const testEvents = (eventResult?.data ?? []).filter((event) => event.is_test || event.properties?.is_test === true);
  // This force-dynamic server page intentionally evaluates health against request time.
  // eslint-disable-next-line react-hooks/purity
  const requestNow = Date.now();
  const dayAgo = requestNow - 24 * 60 * 60_000;
  const events24h = events.filter((event) => new Date(event.created_at).getTime() >= dayAgo).length;
  const feedback24h = allFeedback.filter((row) => new Date(row.created_at).getTime() >= dayAgo).length;
  const latestAggregation = rows.map((row) => row.updated_at).sort().at(-1) ?? null;
  const configurationReady = Boolean(supabase) && !eventResult?.error && !feedbackResult?.error;
  const health = analyticsHealthStatus({ configured: configurationReady, lastEventAt: events[0]?.created_at ?? null, eventsLast24Hours: events24h, latestAggregationAt: latestAggregation });
  const presenceRows = presenceResult?.data ?? [];
  const activePresence = aggregateActiveListeners(presenceRows, null, requestNow);
  const activeChannelCount = new Set(presenceRows.filter((row) => row.player_state === "playing" && !row.is_test && new Date(row.last_seen_at).getTime() >= requestNow - 90_000 && new Date(row.expires_at).getTime() > requestNow).map((row) => row.channel_id).filter(Boolean)).size;
  const recentHeartbeatCount = presenceRows.filter((row) => !row.is_test && new Date(row.heartbeat_window_started_at).getTime() >= requestNow - 5 * 60_000).reduce((sum, row) => sum + row.heartbeat_count, 0);
  const expiredPresenceCount = presenceRows.filter((row) => new Date(row.expires_at).getTime() <= requestNow).length;
  const lastHeartbeat = presenceRows.find((row) => !row.is_test)?.last_seen_at ?? null;
  const filterQuery = new URLSearchParams(Object.entries(search).flatMap(([key, item]) => typeof item === "string" && item ? [[key, item]] : [])).toString();

  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
    <div><h1 className="text-3xl font-black">Analytics</h1><p className="mt-1 text-sm text-white/55">Live Supabase metrics, feedback quality and collection health.</p></div>

    <section aria-labelledby="listening-kpis"><h2 id="listening-kpis" className="text-xl font-black">Listening overview</h2><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
      {[["Sessions", totals.sessions], ["Unique sessions", totals.unique], ["Listening hours", (totals.seconds / 3600).toFixed(1)], ["Completion rate", percent(completionRate(totals.completed, totals.started) * 100)], ["Skips", totals.skips], ["Player errors", totals.errors], ["Shares", totals.shares], ["Sponsor CTR", percent(sponsorCtr(sponsorTotals.clicks, sponsorTotals.impressions) * 100)]].map(([label, amount]) => <div key={String(label)} className="rounded-lg border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase text-white/50">{label}</p><p className="mt-2 text-2xl font-black">{amount}</p></div>)}
    </div></section>
    <section className="grid gap-4 md:grid-cols-2" aria-label="Language and channel mode usage">
      <Distribution title="Sessions by language" entries={Object.entries(sessionsByLanguage).sort((a, b) => b[1] - a[1])} total={totals.sessions} />
      <Distribution title="Sessions by channel mode" entries={Object.entries(sessionsByMode).sort((a, b) => b[1] - a[1])} total={totals.sessions} />
    </section>

    <section aria-labelledby="health-title" className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="health-title" className="text-xl font-black">Analytics health</h2><p className="mt-1 text-sm text-white/55">Behavioral events require explicit consent. Feedback is a separately classified essential pilot submission.</p></div><span className="rounded-full border border-white/15 px-3 py-1 text-sm font-black">{health}</span></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-white/45">Configuration</dt><dd className="font-bold">{configurationReady ? "Configured" : "Misconfigured"}</dd></div><div><dt className="text-white/45">Consent</dt><dd className="font-bold">Explicit opt-in</dd></div><div><dt className="text-white/45">Last real event</dt><dd className="font-bold">{shortDate(events[0]?.created_at ?? null)}</dd></div><div><dt className="text-white/45">Events, last 24h</dt><dd className="font-bold">{events24h}</dd></div>
        <div><dt className="text-white/45">Last daily update</dt><dd className="font-bold">{shortDate(latestAggregation)}</dd></div><div><dt className="text-white/45">Aggregation</dt><dd className="font-bold">On demand at ingestion</dd></div><div><dt className="text-white/45">Pending aggregation</dt><dd className="font-bold">None - inline updates</dd></div><div><dt className="text-white/45">Feedback storage</dt><dd className="font-bold">{feedbackResult?.error ? "Migration required" : "Ready"}</dd></div><div><dt className="text-white/45">Feedback, last 24h</dt><dd className="font-bold">{feedback24h}</dd></div><div><dt className="text-white/45">Sentiment provider</dt><dd className="font-bold">{sentimentProviderConfigured() ? "Configured" : "Pending configuration"}</dd></div><div><dt className="text-white/45">Pending sentiment</dt><dd className="font-bold">{feedbackMetrics(allFeedback).pending}</dd></div><div><dt className="text-white/45">Test events excluded</dt><dd className="font-bold">{testEvents.length}</dd></div>
        <div><dt className="text-white/45">Active listeners now</dt><dd className="font-bold">{presenceResult?.error ? "Unavailable" : activePresence.total}</dd></div><div><dt className="text-white/45">Active channels</dt><dd className="font-bold">{presenceResult?.error ? "Unavailable" : activeChannelCount}</dd></div><div><dt className="text-white/45">Last heartbeat</dt><dd className="font-bold">{shortDate(lastHeartbeat)}</dd></div><div><dt className="text-white/45">Heartbeats, last 5m</dt><dd className="font-bold">{presenceResult?.error ? "Unavailable" : recentHeartbeatCount}</dd></div><div><dt className="text-white/45">Expired presence rows</dt><dd className="font-bold">{presenceResult?.error ? "Unavailable" : expiredPresenceCount}</dd></div><div><dt className="text-white/45">Presence service</dt><dd className="font-bold">{presenceResult?.error ? "Migration required" : "Ready"}</dd></div>
      </dl>
      {canReadFeedback ? <div className="mt-4 flex flex-wrap gap-2"><form action={sendTestAnalyticsEventAction}><button className="rounded-md border border-white/20 px-3 py-2 text-sm font-bold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">Send test analytics event</button></form><form action={sendTestPresenceAction}><button className="rounded-md border border-white/20 px-3 py-2 text-sm font-bold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">Send test heartbeat</button></form></div> : null}
    </section>

    {canReadFeedback ? <section aria-labelledby="feedback-overview" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="feedback-overview" className="text-2xl font-black">Feedback overview</h2><p className="mt-1 text-sm text-white/55">Satisfaction comes from ratings; sentiment comes only from comments or an administrator override.</p></div><div className="flex gap-2"><form action={analysePendingFeedbackAction}><button className="rounded-md border border-white/20 px-3 py-2 text-sm font-bold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">Analyse pending</button></form><Link href={`/api/admin/feedback/export${filterQuery ? `?${filterQuery}` : ""}`} className="rounded-md bg-white px-3 py-2 text-sm font-bold text-black focus:outline-none focus:ring-2 focus:ring-emerald-300">Export CSV</Link></div></div>
      <form className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs font-bold">From<input type="date" name="from" defaultValue={filters.from} className="mt-1 min-h-10 w-full rounded-md bg-neutral-900 px-2" /></label><label className="text-xs font-bold">To<input type="date" name="to" defaultValue={filters.to} className="mt-1 min-h-10 w-full rounded-md bg-neutral-900 px-2" /></label><label className="text-xs font-bold">Rating<select name="rating" defaultValue={filters.rating ?? ""} className="mt-1 min-h-10 w-full rounded-md bg-neutral-900 px-2"><option value="">All</option>{[1,2,3,4,5].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-bold">Sentiment<select name="sentiment" defaultValue={filters.sentiment ?? ""} className="mt-1 min-h-10 w-full rounded-md bg-neutral-900 px-2"><option value="">All</option>{sentimentLabels.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">Category<select name="category" defaultValue={filters.category ?? ""} className="mt-1 min-h-10 w-full rounded-md bg-neutral-900 px-2"><option value="">All</option>{feedbackCategories.map((item) => <option key={item} value={item}>{categoryNames[item]}</option>)}</select></label><label className="text-xs font-bold">Channel<select name="channel" defaultValue={filters.channelId ?? ""} className="mt-1 min-h-10 w-full rounded-md bg-neutral-900 px-2"><option value="">All</option>{channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs font-bold sm:col-span-2">Song<select name="song" defaultValue={filters.songId ?? ""} className="mt-1 min-h-10 w-full rounded-md bg-neutral-900 px-2"><option value="">All songs</option>{songs.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="flex items-end gap-2"><button className="min-h-10 rounded-md bg-emerald-300 px-4 text-sm font-black text-black">Apply</button><Link href="/admin/analytics" className="min-h-10 rounded-md border border-white/20 px-3 py-2 text-sm font-bold">Clear</Link></div>
      </form>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["Responses", metrics.total], ["Average rating", metrics.averageRating.toFixed(2)], ["Rated 4–5", percent(metrics.satisfiedPercentage)], ["Rated 1–2", percent(metrics.dissatisfiedPercentage)], ["Comment rate", percent(metrics.commentRate)], ["Positive comments", percent(metrics.positivePercentage)], ["Negative comments", percent(metrics.negativePercentage)], ["Pending sentiment", metrics.pending]].map(([label, amount]) => <div key={String(label)} className="rounded-lg border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase text-white/50">{label}</p><p className="mt-2 text-2xl font-black">{amount}</p></div>)}</div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Distribution title="Rating distribution" entries={[1,2,3,4,5].map((item) => [`${item} star`, ratings[item] ?? 0])} total={feedback.length} /><Distribution title="Comment sentiment" entries={[...sentimentLabels, "Unanalysed"].map((item) => [item, sentiments[item] ?? 0])} total={feedback.length} /><Distribution title="Categories" entries={Object.entries(categories).sort((a,b) => b[1]-a[1])} total={feedback.length} /><Distribution title="Feedback volume by day" entries={Object.entries(dates).sort((a,b) => a[0].localeCompare(b[0])).slice(-14)} total={feedback.length} /><Distribution title="Rating trend by day" entries={Object.keys(dates).sort().slice(-14).map((day) => { const dayRows = feedback.filter((row) => row.created_at.startsWith(day)); return [day, Number((dayRows.reduce((sum,row) => sum + row.rating, 0) / dayRows.length).toFixed(1))]; })} total={5} /><Distribution title="Top themes" entries={Object.entries(themes).sort((a,b) => b[1]-a[1]).slice(0,10)} total={feedback.length} /></div>
      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/5"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-black/25 text-xs uppercase text-white/50"><tr>{["Date","Rating","Category","Channel / song","Comment","Sentiment","Confidence","Themes","Status","Override","Action"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody>{feedback.map((row) => <tr key={row.id} className="border-t border-white/10 align-top"><td className="whitespace-nowrap px-3 py-3">{shortDate(row.created_at)}</td><td className="px-3 py-3"><strong>{row.rating}/5</strong><br/><span className="text-xs text-white/45">{satisfactionFromRating(row.rating)}</span></td><td className="px-3 py-3">{row.category ? categoryNames[row.category] : "—"}</td><td className="px-3 py-3">{channelName.get(row.channel_id ?? "") ?? "—"}<br/><span className="text-xs text-white/50">{songName.get(row.song_id ?? "") ?? "—"}</span></td><td className="max-w-sm px-3 py-3">{row.comment ? <details><summary className="cursor-pointer font-semibold">View comment</summary><p className="mt-2 whitespace-pre-wrap break-words text-white/75">{row.comment}</p></details> : "No comment"}</td><td className="px-3 py-3">{row.sentiment_label ?? "—"}<br/>{row.admin_sentiment_override ? <span className="text-xs text-amber-200">Admin: {row.admin_sentiment_override}</span> : null}</td><td className="px-3 py-3">{row.sentiment_confidence == null ? "—" : percent(Number(row.sentiment_confidence) * 100)}</td><td className="px-3 py-3">{row.detected_themes?.join(", ") || "—"}</td><td className="px-3 py-3">{row.sentiment_status}</td><td className="px-3 py-3"><form action={overrideSentimentAction} className="flex gap-1"><input type="hidden" name="id" value={row.id}/><select name="sentiment" defaultValue={row.admin_sentiment_override ?? ""} className="min-h-9 rounded bg-neutral-900 px-2"><option value="">None</option>{sentimentLabels.map((item) => <option key={item}>{item}</option>)}</select><button className="rounded border border-white/20 px-2 font-bold">Save</button></form></td><td className="px-3 py-3">{row.comment ? <form action={reanalyseFeedbackAction}><input type="hidden" name="id" value={row.id}/><button className="rounded border border-white/20 px-2 py-1 font-bold">Re-analyse</button></form> : "—"}</td></tr>)}</tbody></table>{feedback.length === 0 ? <p className="p-6 text-center text-white/55">No feedback matches these filters.</p> : null}</div></section>
    </section> : <section className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">Feedback analytics are restricted to active administrators.</section>}
  </main>;
}
