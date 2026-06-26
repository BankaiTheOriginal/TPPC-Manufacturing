-- Workbook gap fix: capture bag base size so the cost engine can resolve
-- the per-bag base cost (small/medium=5, large=10, xlarge=15).
ALTER TABLE "ProductOrderOperation"
ADD COLUMN "bagBaseSize" TEXT;

-- The previous default of 65 on twistedHandles confused count with the
-- per-handle cost. Twisted handle cost is now derived (count * N65) by the
-- production cost service. Existing rows keep their value; the default is
-- removed so new rows do not auto-fill a misleading count.
ALTER TABLE "ProductOrderOperation"
ALTER COLUMN "twistedHandles" DROP DEFAULT;
