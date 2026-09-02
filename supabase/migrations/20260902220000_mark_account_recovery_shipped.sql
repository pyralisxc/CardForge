update public.cardforge_roadmap_items
set
  status = 'shipped',
  updated_at = timezone('utc', now())
where id = 'd2c3649e-a8e6-4c3f-ad26-39b34d346e1f'
  and title = 'Account recovery and safety tooling'
  and status <> 'shipped';
