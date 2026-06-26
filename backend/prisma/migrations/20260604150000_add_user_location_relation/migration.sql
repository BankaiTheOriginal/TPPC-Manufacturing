ALTER TABLE "User"
ADD COLUMN "locationId" TEXT;

CREATE INDEX "User_locationId_idx" ON "User"("locationId");

ALTER TABLE "User"
ADD CONSTRAINT "User_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;