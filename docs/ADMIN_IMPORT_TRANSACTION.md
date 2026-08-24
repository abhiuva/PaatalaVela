# Admin Import Transaction

YouTube video and approved playlist imports call `import_song_with_assignment_atomic` through the server-only Supabase service client. Browser code receives no service key or SQL detail.

The RPC validates the channel, serializes the YouTube ID across channels, resolves or creates one song, writes taxonomy, locks the target channel, shifts positions collision-safely, creates or reactivates one assignment, records audit events, and returns the committed assignment sequence. PostgreSQL rolls back every write if any stage fails.

Existing-song behavior is explicit:

- another channel: `assigned_existing`
- same active channel: `already_assigned`
- same inactive assignment: `reactivated`
- new song: `imported`

Channel allocation uses an advisory transaction lock and never trusts row count or cached catalogue state. Concurrent imports cannot receive the same `(channel_id, sequence)`, and same-video imports to different channels converge on one song record.

Admin errors expose a safe stage and stable code for validation, permission, channel assignment, sequence conflict, or transaction failure. Raw SQL, credentials, and service details are logged neither to the browser nor the action result. Successful actions revalidate `/admin`, `/api/catalogue`, and the affected UUID-keyed catalogue route only.
