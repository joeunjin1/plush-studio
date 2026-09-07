-- Allow reviewed GLB reference models in the public product catalog only.
-- The private plush-studio bucket and its buyer/project/factory storage rules are unchanged.

update storage.buckets
set allowed_mime_types = array[
  'image/png',
  'image/jpeg',
  'image/webp',
  'model/gltf-binary'
]
where id = 'plush-studio-catalog';
