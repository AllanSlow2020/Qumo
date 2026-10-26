-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "minimumAge" INTEGER;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "ageConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "ageConfirmedMinimum" INTEGER,
ADD COLUMN     "ageRefusedAt" TIMESTAMP(3);
