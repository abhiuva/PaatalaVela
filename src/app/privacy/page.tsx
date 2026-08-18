export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <article className="mx-auto max-w-3xl space-y-4 rounded-lg border border-white/15 bg-white/8 p-5">
        <h1 className="text-3xl font-black">Privacy Policy</h1>
        <p>This operational template requires professional legal review before commercial launch.</p>
        <p>Essential radio playback works without analytics consent. If accepted, anonymous session analytics may measure playback starts, completions, skips, player errors, sponsor impressions and sponsor clicks.</p>
        <p>Analytics does not collect names, emails, YouTube account data, precise location, full user-agent strings or permanent cross-device identifiers.</p>
        <p>Local storage stores playback preferences and analytics consent. Supabase may process catalogue, takedown, song-request and aggregate analytics data. Raw listening events are designed for 90-day retention; aggregate metrics may be retained.</p>
        <p>Pilot feedback is submitted only when you choose to send it. It may include a rating, optional comment and category plus current channel, song, page, anonymous session and deployment context. We do not ask for your name, email or phone number, and full IP addresses are not stored with feedback.</p>
        <p>The live listener count uses strictly necessary, anonymous presence while playback is active. A random browser identifier is hashed on the server, never shown publicly, and expires from the active count after 90 seconds without a playing heartbeat. No name, contact information, Auth identity, full IP address or raw user-agent string is stored.</p>
        <p>Public listener totals are aggregates only. Individual listening identities and presence rows are never returned to public visitors.</p>
        <p>You can change analytics consent from the footer at any time.</p>
      </article>
    </main>
  );
}
