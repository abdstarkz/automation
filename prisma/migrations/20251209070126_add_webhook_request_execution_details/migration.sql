/*
  Warnings:

  - You are about to drop the `schedule_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "schedule_configs" DROP CONSTRAINT "schedule_configs_workflow_id_fkey";

-- AlterTable
ALTER TABLE "webhook_requests" ADD COLUMN     "error" TEXT,
ADD COLUMN     "workflow_execution_id" TEXT;

-- DropTable
DROP TABLE "schedule_configs";
