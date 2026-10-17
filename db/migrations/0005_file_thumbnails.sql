-- Small preview images for uploaded pictures, so the creative can see which file is which while renaming.
-- The browser makes a thumbnail (about 480 px, JPEG) and uploads it beside the file. "thumbKey" is set once the
-- server has checked the thumbnail's size in storage; a file without one just shows a generic icon.

alter table "deliveryFile" add column if not exists "thumbKey" text;
