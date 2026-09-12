-- CreateTable
CREATE TABLE "StaffPasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPasswordReset_tokenHash_key" ON "StaffPasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffPasswordReset_userId_idx" ON "StaffPasswordReset"("userId");

-- CreateIndex
CREATE INDEX "StaffPasswordReset_expiresAt_idx" ON "StaffPasswordReset"("expiresAt");

-- AddForeignKey
ALTER TABLE "StaffPasswordReset" ADD CONSTRAINT "StaffPasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
