-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpSecretEncrypted" TEXT;

-- CreateTable
CREATE TABLE "StaffRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffRecoveryCode_codeHash_key" ON "StaffRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "StaffRecoveryCode_userId_idx" ON "StaffRecoveryCode"("userId");

-- AddForeignKey
ALTER TABLE "StaffRecoveryCode" ADD CONSTRAINT "StaffRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
