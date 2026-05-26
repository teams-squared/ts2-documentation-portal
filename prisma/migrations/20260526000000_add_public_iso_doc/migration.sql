-- Adds PublicIsoDoc table for the /policies library surface.
--
-- Mirrors PolicyDocLesson's SharePoint-pointer + parsed-metadata fields
-- but drops the audit-snapshot columns (renderedHTML / renderedHTMLHash)
-- and the LessonProgress join — there's no acknowledgement obligation,
-- this is read-reference for any logged-in LMS user.
--
-- Additive only.

CREATE TABLE IF NOT EXISTS "PublicIsoDoc" (
  "id"                  TEXT         NOT NULL,

  -- SharePoint source pointer
  "sharePointDriveId"   TEXT         NOT NULL,
  "sharePointItemId"    TEXT         NOT NULL,
  "sharePointWebUrl"    TEXT         NOT NULL,

  -- Snapshot from last sync
  "documentTitle"       TEXT         NOT NULL,
  "documentCode"        TEXT,
  "sourceVersion"       TEXT         NOT NULL,
  "sourceETag"          TEXT         NOT NULL,
  "sourceLastModified"  TIMESTAMP(3) NOT NULL,
  "approver"            TEXT,
  "approvedOn"          TIMESTAMP(3),
  "lastReviewedOn"      TIMESTAMP(3),
  "reviewHistory"       JSONB        NOT NULL,
  "revisionHistory"     JSONB        NOT NULL,

  -- Display
  "sortOrder"           INTEGER      NOT NULL DEFAULT 0,

  -- Provenance
  "publishedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedById"       TEXT         NOT NULL,

  -- Sync bookkeeping
  "lastSyncedAt"        TIMESTAMP(3) NOT NULL,
  "lastSyncedById"      TEXT         NOT NULL,

  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PublicIsoDoc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublicIsoDoc_sharePointDriveId_sharePointItemId_key"
  ON "PublicIsoDoc"("sharePointDriveId", "sharePointItemId");

CREATE INDEX IF NOT EXISTS "PublicIsoDoc_sortOrder_idx"
  ON "PublicIsoDoc"("sortOrder");

CREATE INDEX IF NOT EXISTS "PublicIsoDoc_documentCode_idx"
  ON "PublicIsoDoc"("documentCode");

DO $$ BEGIN
  ALTER TABLE "PublicIsoDoc"
    ADD CONSTRAINT "PublicIsoDoc_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PublicIsoDoc"
    ADD CONSTRAINT "PublicIsoDoc_lastSyncedById_fkey"
    FOREIGN KEY ("lastSyncedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
