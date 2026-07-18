
CREATE OR REPLACE FUNCTION public.credit_balance(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(delta),0)::int
  FROM public.credit_ledger
  WHERE user_id = _user_id
    AND _user_id = auth.uid();
$$;
