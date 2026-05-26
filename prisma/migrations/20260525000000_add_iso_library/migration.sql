-- ISO Docs reference library — admin curates a flat list of existing
-- PolicyDocLessons surfaced at /iso-docs for any logged-in user. View-only;
-- ack evidence still flows through the course path (LessonProgress).

CREATE TABLE "IsoLibraryEntry" (
    "id"                TEXT NOT NULL,
    "policyDocLessonId" TEXT NOT NULL,
    "sortOrder"         INTEGER NOT NULL DEFAULT 0,
    "addedById"         TEXT NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IsoLibraryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IsoLibraryEntry_policyDocLessonId_key"
    ON "IsoLibraryEntry"("policyDocLessonId");

CREATE INDEX "IsoLibraryEntry_sortOrder_idx"
    ON "IsoLibraryEntry"("sortOrder");

ALTER TABLE "IsoLibraryEntry"
    ADD CONSTRAINT "IsoLibraryEntry_policyDocLessonId_fkey"
    FOREIGN KEY ("policyDocLessonId") REFERENCES "PolicyDocLesson"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IsoLibraryEntry"
    ADD CONSTRAINT "IsoLibraryEntry_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;


-- Audit log — one row per /iso-docs/[entryId] open. Best-effort,
-- fire-and-forget from the viewer. Not used for ISO ack evidence.
CREATE TABLE "IsoLibraryView" (
    "id"            TEXT NOT NULL,
    "entryId"       TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "viewedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceVersion" TEXT,
    CONSTRAINT "IsoLibraryView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IsoLibraryView_entryId_viewedAt_idx"
    ON "IsoLibraryView"("entryId", "viewedAt");

CREATE INDEX "IsoLibraryView_userId_viewedAt_idx"
    ON "IsoLibraryView"("userId", "viewedAt");

ALTER TABLE "IsoLibraryView"
    ADD CONSTRAINT "IsoLibraryView_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "IsoLibraryEntry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IsoLibraryView"
    ADD CONSTRAINT "IsoLibraryView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
