/*
  Warnings:

  - You are about to drop the column `name` on the `Merchant` table. All the data in the column will be lost.
  - Added the required column `businessName` to the `Merchant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country` to the `Merchant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `merchantName` to the `Merchant` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Merchant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "merchantApiKey" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Merchant" ("address", "createdAt", "email", "id", "merchantApiKey", "merchantId", "password", "phone", "status", "stripeAccountId", "updatedAt") SELECT "address", "createdAt", "email", "id", "merchantApiKey", "merchantId", "password", "phone", "status", "stripeAccountId", "updatedAt" FROM "Merchant";
DROP TABLE "Merchant";
ALTER TABLE "new_Merchant" RENAME TO "Merchant";
CREATE UNIQUE INDEX "Merchant_merchantId_key" ON "Merchant"("merchantId");
CREATE UNIQUE INDEX "Merchant_merchantApiKey_key" ON "Merchant"("merchantApiKey");
CREATE UNIQUE INDEX "Merchant_email_key" ON "Merchant"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
