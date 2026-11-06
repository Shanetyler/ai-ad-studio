# Sign-in diagnosis: Google "failed to check consent" and email "failed to fetch"

## Finding (confirmed)
The app's hosted backend (database + sign-in service) is **paused**. Every sign-in request fails before it reaches any app code:
- Email sign-in: the browser can't reach the sign-in service, so it shows "failed to fetch".
- Google sign-in: Google itself succeeds, but the final step that saves the session to the backend can't complete, so it shows "failed to check consent".

Evidence:
- Backend status check reports: paused.
- The sign-in service health address returns no response, while ordinary internet access from the same environment works.
- Preview logs show no app crashes.

## What is NOT the cause (checked)
- Settings for where sign-in returns (Site URL and allowed return addresses) are correct and include the preview address.
- All required connection settings are present (names only checked: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY).
- Sign-in page code uses the correct Google and email sign-in calls. No code defect explains these errors.

Classification: configuration/hosting state, not an app-code bug.

## Fix (no code changes needed)
1. In Lovable, open More → Database → Manage → Settings (Cloud).
2. Click **Resume** for the backend.
3. Wait until it reports active (usually a few minutes).
4. Reload the preview and retry email sign-in, then Google.

Resuming keeps all existing users, sign-in identities, characters, projects and data.

## Optional follow-up after resume (only if you approve)
- I re-check backend status and confirm the sign-in service responds, then test a signed-in page load. No edits.
- Minor, unrelated to this error: the Google button sends you back to the `next` page directly; if issues remain after resume, I'd change it to return to the main page first, then redirect. Not needed now.
