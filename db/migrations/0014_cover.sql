-- The client page's cover: the template the creative picked, the words they wrote for it, where the photo is held,
-- and the large cover picture made from one of the delivery's photos ("key", set only by the server).
-- Null means the delivery has never been through the designer; the page then uses the classic template.
--
-- One nullable column, so it can be applied while the app is running.

alter table "delivery" add column if not exists "cover" jsonb;
