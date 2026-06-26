-- CreateEnum
CREATE TYPE "State" AS ENUM ('Abia', 'Adamawa', 'AkwaIbom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'CrossRiver', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara');

-- AlterTable
ALTER TABLE "ProductOrderOperation" ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "stageStatus" TEXT DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'NIGERIA',
    "state" "State" NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);
