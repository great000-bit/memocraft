-- File uploads. A file row is attached once "storageKey" is set and the object has been checked in storage.
-- While an upload is running, "pending" holds {key, uploadId, size, type, ext, at}; a replacement upload keeps
-- the old "storageKey" valid until the new object is confirmed.

alter table "deliveryFile"
  add column if not exists "ext" text,
  add column if not exists "pending" jsonb;
