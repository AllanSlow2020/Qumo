-- CreateEnum
CREATE TYPE "ProofTier" AS ENUM ('SIGNED', 'UNSIGNED', 'PHOTO');

-- AlterTable
ALTER TABLE "EarnRule" ADD COLUMN     "minProofTier" "ProofTier" NOT NULL DEFAULT 'UNSIGNED';

-- AlterTable
ALTER TABLE "PurchaseScan" ADD COLUMN     "proofTier" "ProofTier" NOT NULL DEFAULT 'UNSIGNED';

-- Backfill, and this is not optional.
--
-- The default above marks every existing scan UNSIGNED, including the ones
-- that carried a valid signature. PurchaseScan.wasSigned is recorded per
-- scan precisely so that a store which is signed today cannot rewrite what
-- was true of a slip scanned last month, and leaving the default in place
-- would do exactly that rewriting, to every signed scan at once.
UPDATE "PurchaseScan" SET "proofTier" = 'SIGNED' WHERE "wasSigned" = true;
