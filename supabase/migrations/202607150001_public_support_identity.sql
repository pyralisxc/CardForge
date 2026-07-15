-- Keep the public support address distinct from the configured privileged owner identity.

update public.cardforge_owner_settings
set support_email = 'pyraliscameron@gmail.com', updated_at = now()
where id = 'cardforge';
