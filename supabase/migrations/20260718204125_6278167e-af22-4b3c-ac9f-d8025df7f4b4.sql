
-- Allow authenticated users to call credit_balance for themselves
GRANT EXECUTE ON FUNCTION public.credit_balance(uuid) TO authenticated;

-- Recreate signup trigger (it was missing on auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any users missing their signup grant
INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT u.id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;

INSERT INTO public.subscriptions (user_id, tier, monthly_credit_grant)
SELECT u.id, 'free', 30
FROM auth.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.user_id IS NULL;

INSERT INTO public.credit_ledger (user_id, delta, reason)
SELECT u.id, 30, 'signup_grant'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.credit_ledger l
  WHERE l.user_id = u.id AND l.reason = 'signup_grant'
);
