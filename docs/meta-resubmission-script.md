# Meta App Review — Resubmission Kit (Aug 2026)

**Status from July 24 review:**
- ✅ Approved: `pages_show_list`, `read_insights`, `pages_read_engagement`
- ❌ Rejected (screencast only — use case itself ruled "allowed"): `instagram_basic`, `instagram_manage_insights`, Instagram Public Content Access

**Resubmit ONLY:** `instagram_basic` + `instagram_manage_insights`.
**Do NOT re-request** Instagram Public Content Access (hashtag search — no visible feature uses it; it will fail again and drag the review).

---

## Pre-flight checklist (before recording)

- [ ] Log in fresh as `reviewer@dronehubmedia.com` / `DroneHubReview2026!` at
      https://sparkly-halva-0d1aa9.netlify.app — confirm no session-expired
      hiccups and Social → Analytics loads.
- [ ] Have a real Instagram **Business** account linked to a Facebook Page you
      manage, with enough recent posts/Reels that the insights charts populate.
- [ ] Browser + app UI in **English**. Close other tabs. Hide bookmarks bar.
- [ ] Record at 1080p+, mouse visible, unhurried pace (reviewers watch once).
- [ ] One continuous take — no cuts between login and the analytics screens.

## Screencast script (~2–3 minutes, ONE take)

| # | On screen | Caption overlay (add in your editor) |
|---|-----------|--------------------------------------|
| 1 | Logged-OUT browser → open the app URL → sign in with the reviewer account | "DroneHub — real-estate media platform. Signing in with the review account." |
| 2 | Navigate: Social → Analytics. Show the empty/connect state | "The Social Analytics dashboard. No Meta data yet — we connect with Facebook Login for Business." |
| 3 | Click **Connect with Facebook**. Let the Meta OAuth dialog load FULLY. | "Complete Meta login flow begins here." |
| 4 | On the permissions screen, PAUSE 3–4 seconds so the listed permissions are readable, then click Allow/Continue | "The user grants instagram_basic and instagram_manage_insights. Access is read-only." |
| 5 | Back in the app: the account picker lists the Instagram Business account (username + profile photo), click it | "instagram_basic — we read the connected account's username and profile to list it for selection." |
| 6 | Account detail page loads. Slowly scroll: daily reach chart → per-post views / reach / saves / shares → Reels watch time | "instagram_manage_insights — daily reach, per-post performance, and Reels average & total watch time, shown only to the account's owner." |
| 7 | Hover a chart point / open one post's metrics | "All insights are read-only and displayed in-app. Nothing is published or modified." |
| 8 | End on the populated dashboard | "End of flow — data is deleted if the user disconnects the account." |

**Their 5 requirements → where the script covers them:**
1. Complete Meta login flow → scenes 3–4
2. User granting the permission → scene 4 (the pause matters)
3. End-to-end use-case experience → scenes 5–7
4. English UI + captions/tool-tips → caption column
5. Server-to-server note → N/A (we use the visible frontend login; nothing to declare)

## Submission notes (paste per permission — same as before, lightly tightened)

**instagram_basic**
> We use instagram_basic to identify the Instagram Business account the user
> connects through Facebook Login for Business — reading its username and
> profile info so the user can select it and see it labeled in our Social
> Analytics dashboard. Read-only; nothing is published or modified. The
> attached screencast shows the complete login flow, the grant dialog, and the
> account being listed and selected using this permission.

**instagram_manage_insights**
> We use instagram_manage_insights to display performance analytics for the
> user's own connected Instagram Business account: daily reach, per-post
> views, reach, saves and shares, and for Reels average and total watch time.
> Shown only to the account owner and their authorized team; never used for
> advertising; deleted on disconnect. The attached screencast shows the
> complete login flow, the grant dialog, and each of these insights rendering
> in the dashboard.

## Submitting

1. App Review → Requests → **Request again**.
2. Include only the two IG permissions; attach the SAME new screencast to both.
3. Keep the existing reviewer credentials text (unchanged, still valid).
