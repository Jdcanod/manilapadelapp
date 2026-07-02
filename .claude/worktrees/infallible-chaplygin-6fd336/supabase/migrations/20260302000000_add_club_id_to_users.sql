-- Migration to add club_id to users to associate players with a specific club
ALTER TABLE public.users
ADD COLUMN club_id UUID;

-- We don't add a hard foreign key because auth_id is not technically the primary key of public.users but a unique column,
-- or some users might not exist yet if clubs are registered differently. 
-- Assuming club_id maps to public.users(auth_id) where rol='admin_club':
ALTER TABLE public.users
ADD CONSTRAINT fk_users_club
FOREIGN KEY (club_id) REFERENCES public.users(auth_id) ON DELETE SET NULL;
