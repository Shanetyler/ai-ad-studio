
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _amount int, _reason text, _job_id uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance int;
  new_balance int;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Lock the user's ledger rows to prevent concurrent double-spend
  PERFORM 1 FROM public.credit_ledger WHERE user_id = _user_id FOR UPDATE;

  SELECT COALESCE(SUM(delta),0)::int INTO current_balance
  FROM public.credit_ledger WHERE user_id = _user_id;

  IF current_balance < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  INSERT INTO public.credit_ledger (user_id, delta, reason, job_id)
  VALUES (_user_id, -_amount, _reason, _job_id);

  new_balance := current_balance - _amount;
  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_credits(uuid,int,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid,int,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.refund_credits(_user_id uuid, _amount int, _reason text, _job_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.credit_ledger (user_id, delta, reason, job_id)
  VALUES (_user_id, _amount, _reason, _job_id);
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credits(uuid,int,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid,int,text,uuid) TO authenticated;
