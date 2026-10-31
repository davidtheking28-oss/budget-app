update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'] where id = 'advisor-logos';
