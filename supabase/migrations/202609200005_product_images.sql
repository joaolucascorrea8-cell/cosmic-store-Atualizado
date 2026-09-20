-- Execute este arquivo uma única vez no SQL Editor do Supabase.
-- Cria um bucket público para as imagens exibidas no catálogo.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- O envio é feito somente pela rota administrativa do site.
-- O bucket público permite apenas a exibição das imagens do catálogo.
