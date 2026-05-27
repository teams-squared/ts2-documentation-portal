-- Add hide toggle to public ISO library entries — lets admins withdraw
-- a doc from /policies without losing the row, the view history, or the
-- SharePoint pointer. Useful for docs being revised or temporarily
-- withdrawn.

ALTER TABLE "PublicIsoDoc" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
