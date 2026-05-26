-- Rewires the IsoLibraryView audit log from the abandoned IsoLibraryEntry
-- design (from migration 20260525000000_add_iso_library) onto the
-- PublicIsoDoc table (from migration 20260526000000_add_public_iso_doc).
--
-- Both IsoLibraryEntry and the old IsoLibraryView are empty on prod —
-- verified at hybrid-plan time. Safe to drop and recreate. If ever re-run
-- against a fresh DB that lacks the prior tables, the IF EXISTS guards make
-- this a no-op for the drops and a clean create for the new view table.

DROP TABLE IF EXISTS "IsoLibraryView";
DROP TABLE IF EXISTS "IsoLibraryEntry";

CREATE TABLE IF NOT EXISTS "IsoLibraryView" (
  "id"              TEXT         NOT NULL,
  "publicIsoDocId"  TEXT         NOT NULL,
  "userId"          TEXT         NOT NULL,
  "viewedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceVersion"   TEXT,
  CONSTRAINT "IsoLibraryView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IsoLibraryView_publicIsoDocId_viewedAt_idx"
  ON "IsoLibraryView"("publicIsoDocId", "viewedAt");

CREATE INDEX IF NOT EXISTS "IsoLibraryView_userId_viewedAt_idx"
  ON "IsoLibraryView"("userId", "viewedAt");

DO $$ BEGIN
  ALTER TABLE "IsoLibraryView"
    ADD CONSTRAINT "IsoLibraryView_publicIsoDocId_fkey"
    FOREIGN KEY ("publicIsoDocId") REFERENCES "PublicIsoDoc"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IsoLibraryView"
    ADD CONSTRAINT "IsoLibraryView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
