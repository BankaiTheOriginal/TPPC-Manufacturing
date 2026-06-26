-- Extend AuditLog with the 5-W fields, event categorisation, status, severity,
-- actor type, impersonation, request correlation, and a tamper-evident hash
-- chain. Also enforce append-only at the database level via a trigger.

-- userId becomes optional so failed-login and system-actor events can be
-- recorded even when no authenticated user is available.
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "AuditLog"
  ADD COLUMN "eventCategory"    TEXT NOT NULL DEFAULT 'DATA',
  ADD COLUMN "status"           TEXT NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN "severity"         TEXT NOT NULL DEFAULT 'INFO',
  ADD COLUMN "actorType"        TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN "actorEmail"       TEXT,
  ADD COLUMN "impersonatedById" TEXT,
  ADD COLUMN "httpMethod"       TEXT,
  ADD COLUMN "route"            TEXT,
  ADD COLUMN "requestId"        TEXT,
  ADD COLUMN "sessionId"        TEXT,
  ADD COLUMN "metadata"         JSONB,
  ADD COLUMN "prevHash"         TEXT,
  ADD COLUMN "hash"             TEXT;

-- Backfill hash for existing rows so the chain can start from a known anchor.
-- Existing rows get the sentinel hash 'genesis' and are linked sequentially.
WITH ordered AS (
  SELECT
    "id",
    LAG(encode(sha256(("id" || COALESCE("createdAt"::text, ''))::bytea), 'hex'))
      OVER (ORDER BY "createdAt", "id") AS prev,
    encode(sha256(("id" || COALESCE("createdAt"::text, ''))::bytea), 'hex') AS h
  FROM "AuditLog"
)
UPDATE "AuditLog" a
SET "hash"     = ordered.h,
    "prevHash" = COALESCE(ordered.prev, 'genesis')
FROM ordered
WHERE a."id" = ordered."id";

ALTER TABLE "AuditLog" ALTER COLUMN "hash" SET NOT NULL;

CREATE INDEX "AuditLog_eventCategory_idx" ON "AuditLog"("eventCategory");
CREATE INDEX "AuditLog_status_idx"        ON "AuditLog"("status");
CREATE INDEX "AuditLog_severity_idx"      ON "AuditLog"("severity");
CREATE INDEX "AuditLog_requestId_idx"     ON "AuditLog"("requestId");
CREATE INDEX "AuditLog_actorType_idx"     ON "AuditLog"("actorType");

-- Tamper protection: forbid UPDATE/DELETE on the audit log.
-- The application layer must never need to mutate or remove rows; archival
-- jobs should COPY OUT and start a fresh chain rather than delete in place.
CREATE OR REPLACE FUNCTION audit_log_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only; UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON "AuditLog";
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();
