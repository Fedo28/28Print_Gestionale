ALTER TABLE "Order"
ADD COLUMN "globalDiscountMode" "DiscountMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN "globalDiscountValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "globalExtraMode" "DiscountMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN "globalExtraValue" INTEGER NOT NULL DEFAULT 0;
