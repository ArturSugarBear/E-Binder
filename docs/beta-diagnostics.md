# Developer Beta Diagnostics

Testaccount-only E-Binder diagnostics. A server-controlled Supabase Auth app_metadata flag called e_binder_beta_telemetry enables the recorder. This is NOT an administrator role or a permission to access other users' data.

## Events and privacy

- Navigation and button/link interactions are recorded as categories, without free-form button labels or user-entered values.
- UI errors, rejected writes and runtime failures use fixed codes. No stack traces, exception messages, search queries or form values.
- OCR reports only candidate count, known exact-edition catalogue IDs, explicit correction reports and confirmed editions. No camera photos or full OCR transcript is uploaded.
- Each record contains a coarse platform class, build commit prefix and a random session ID.
- The collector is capped at 750 events per tab session. Telemetry failures never block collection use.
- The developer can pause or resume diagnostics from Profile on the device.

## Safe rollout

1. Apply the migration in supabase/migrations/20261110193000_beta_diagnostics.sql.
2. Verify RLS policies, grants and owner isolation.
3. Grant the app metadata flag only to the confirmed artur-dev Auth UUID; never set flags from client-side user_metadata.
4. Refresh the account session after rollout. Confirm a real interaction creates an event.
5. Keep the standard user's account and collection untouched.

## Review queries (admin only)

Daily grouped failure and friction counts:

    select date_trunc('day',created_at) as day,app_build,event_type,area,action,outcome,count(*)
    from public.beta_diagnostic_events
    group by 1,2,3,4,5,6 order by day desc,count(*) desc;

Scanner feedback:

    select created_at,app_build,platform,action,outcome,card_candidate,card_selected,metric
    from public.beta_diagnostic_events
    where event_type in ('scan_result','scan_review')
    order by created_at desc limit 100;

Delete all stored events from this test account by its verified user UUID before reusing or revoking it. Use a privileged SQL session for retention maintenance. No service-role key may be committed to GitHub. Daily automated export should be configured with a separate scoped server-side identity and retention policy; this PR deliberately does not expose a public report endpoint.
