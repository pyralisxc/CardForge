-- Preserve the original portable artwork bytes in the existing private bucket.
update storage.buckets
set file_size_limit = 33554432,
    allowed_mime_types = array['image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
where id = 'cardforge-studio-document-assets';

update storage.buckets
set file_size_limit = 33554432
where id = 'cardforge-studio-document-fonts';
