-- AlterTable
ALTER TABLE "PointsTransaction" ADD COLUMN     "purchaseScanId" TEXT;

-- CreateIndex
CREATE INDEX "PointsTransaction_purchaseScanId_idx" ON "PointsTransaction"("purchaseScanId");

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_purchaseScanId_fkey" FOREIGN KEY ("purchaseScanId") REFERENCES "PurchaseScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
