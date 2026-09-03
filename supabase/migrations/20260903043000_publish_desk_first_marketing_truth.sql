-- Move the editable marketing source of truth from the retired acquisition
-- phrase "Enter the Studio" to the current Desk-first product journey.
-- Historical migrations remain unchanged; only the still-current strategy and
-- editable draft campaign records that retain the exact retired copy advance.

update public.cardforge_marketing_strategy
set offer = case
      when offer = 'Enter the Studio and build a complete set in your browser.'
        then 'Open your Desk and build a complete Set in your browser.'
      else offer
    end,
    default_call_to_action = case
      when default_call_to_action = 'Enter the Studio'
        then 'Open your Desk'
      else default_call_to_action
    end,
    version = version + 1
where id = 'cardforge'
  and (
    offer = 'Enter the Studio and build a complete set in your browser.'
    or default_call_to_action = 'Enter the Studio'
  );

update public.cardforge_marketing_campaigns
set success_metric = replace(success_metric, 'Qualified Studio visits', 'Qualified Desk visits'),
    version = version + 1
where success_metric like '%Qualified Studio visits%';

update public.cardforge_social_campaigns
set objective = replace(
      replace(objective, 'invite interested readers into the Studio', 'invite interested readers to open their Desk'),
      'invite them to try the live Studio',
      'invite them to open their Desk'
    ),
    production_note = replace(
      replace(production_note, 'current Studio screenshot', 'current Desk and Set screenshot'),
      'current Studio screenshots',
      'current Desk and Set screenshots'
    ),
    variants = replace(
      replace(
        replace(variants::text, 'try the current Studio:', 'open your Desk:'),
        'Try the Studio',
        'Open your Desk'
      ),
      'try the Studio',
      'open your Desk'
    )::jsonb,
    call_to_action = case
      when call_to_action = 'Enter the Studio.' then 'Open your Desk.'
      when call_to_action = 'Enter the Studio' then 'Open your Desk'
      else call_to_action
    end,
    version = version + 1
where status = 'draft'
  and (
    objective ilike '%Studio%'
    or production_note ilike '%Studio%'
    or variants::text ilike '%Studio%'
    or call_to_action ilike '%Studio%'
  );

do $$
begin
  if exists (
    select 1
    from public.cardforge_marketing_strategy
    where id = 'cardforge'
      and (offer ilike '%Enter the Studio%' or default_call_to_action ilike '%Enter the Studio%')
  ) then
    raise exception 'The current marketing strategy still contains the retired Studio acquisition phrase.';
  end if;

  if exists (
    select 1
    from public.cardforge_marketing_campaigns
    where success_metric ilike '%Qualified Studio visits%'
  ) then
    raise exception 'A current marketing campaign still measures retired Studio visits.';
  end if;

  if exists (
    select 1
    from public.cardforge_social_campaigns
    where status = 'draft'
      and (
        objective ilike '%invite%Studio%'
        or production_note ilike '%current Studio screenshot%'
        or variants::text ilike '%try%Studio%'
        or call_to_action ilike '%Enter%Studio%'
      )
  ) then
    raise exception 'An editable marketing draft still contains a retired Studio acquisition phrase.';
  end if;
end $$;
