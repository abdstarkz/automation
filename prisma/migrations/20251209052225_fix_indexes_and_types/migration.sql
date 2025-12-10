/*
  Warnings:

  - A unique constraint covering the columns `[workflow_id]` on the table `schedule_configs` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "execution_logs_timestamp_idx";

-- DropIndex
DROP INDEX "fitbit_activities_user_id_recorded_at_idx";

-- DropIndex
DROP INDEX "fitbit_foods_user_id_recorded_date_idx";

-- DropIndex
DROP INDEX "health_analysis_sessions_user_id_created_at_idx";

-- DropIndex
DROP INDEX "health_data_recorded_at_idx";

-- DropIndex
DROP INDEX "health_insights_is_read_idx";

-- DropIndex
DROP INDEX "personal_time_activities_user_id_date_idx";

-- DropIndex
DROP INDEX "progress_items_last_practiced_at_idx";

-- DropIndex
DROP INDEX "schedule_configs_workflow_id_idx";

-- DropIndex
DROP INDEX "system_logs_level_created_at_idx";

-- DropIndex
DROP INDEX "system_logs_service_idx";

-- DropIndex
DROP INDEX "time_entries_started_at_idx";

-- DropIndex
DROP INDEX "usage_analytics_created_at_idx";

-- DropIndex
DROP INDEX "usage_analytics_user_id_event_type_created_at_idx";

-- DropIndex
DROP INDEX "webhook_requests_created_at_idx";

-- DropIndex
DROP INDEX "workflow_executions_started_at_idx";

-- CreateIndex
CREATE INDEX "api_credentials_user_id_is_active_idx" ON "api_credentials"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_is_favorite_updated_at_idx" ON "bookmarks"("user_id", "is_favorite", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "execution_logs_timestamp_idx" ON "execution_logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "execution_logs_execution_id_timestamp_idx" ON "execution_logs"("execution_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "fitbit_activities_user_id_recorded_at_idx" ON "fitbit_activities"("user_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "fitbit_foods_user_id_recorded_date_idx" ON "fitbit_foods"("user_id", "recorded_date" DESC);

-- CreateIndex
CREATE INDEX "fitbit_tokens_expires_at_idx" ON "fitbit_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "health_analysis_sessions_user_id_created_at_idx" ON "health_analysis_sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "health_data_user_id_recorded_at_idx" ON "health_data"("user_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "health_data_user_id_data_type_recorded_at_idx" ON "health_data"("user_id", "data_type", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "health_goals_user_id_goal_type_is_active_idx" ON "health_goals"("user_id", "goal_type", "is_active");

-- CreateIndex
CREATE INDEX "health_insights_user_id_is_read_idx" ON "health_insights"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "health_insights_user_id_is_read_created_at_idx" ON "health_insights"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "integrations_user_id_is_active_idx" ON "integrations"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "learning_resources_user_id_is_completed_idx" ON "learning_resources"("user_id", "is_completed");

-- CreateIndex
CREATE INDEX "note_folders_user_id_parent_id_idx" ON "note_folders"("user_id", "parent_id");

-- CreateIndex
CREATE INDEX "notes_user_id_is_pinned_updated_at_idx" ON "notes"("user_id", "is_pinned", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "personal_time_activities_user_id_date_idx" ON "personal_time_activities"("user_id", "date" DESC);

-- CreateIndex
CREATE INDEX "personal_time_activities_user_id_activity_type_date_idx" ON "personal_time_activities"("user_id", "activity_type", "date" DESC);

-- CreateIndex
CREATE INDEX "personal_time_goals_user_id_is_active_idx" ON "personal_time_goals"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "progress_items_last_practiced_at_idx" ON "progress_items"("last_practiced_at" DESC);

-- CreateIndex
CREATE INDEX "progress_items_user_id_status_last_practiced_at_idx" ON "progress_items"("user_id", "status", "last_practiced_at" DESC);

-- CreateIndex
CREATE INDEX "schedule_configs_is_active_next_run_at_idx" ON "schedule_configs"("is_active", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_configs_workflow_id_key" ON "schedule_configs"("workflow_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "study_plans_user_id_is_active_start_date_idx" ON "study_plans"("user_id", "is_active", "start_date" DESC);

-- CreateIndex
CREATE INDEX "system_logs_level_created_at_idx" ON "system_logs"("level", "created_at" DESC);

-- CreateIndex
CREATE INDEX "system_logs_service_created_at_idx" ON "system_logs"("service", "created_at" DESC);

-- CreateIndex
CREATE INDEX "time_entries_started_at_idx" ON "time_entries"("started_at" DESC);

-- CreateIndex
CREATE INDEX "time_entries_progress_item_id_started_at_idx" ON "time_entries"("progress_item_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "usage_analytics_user_id_event_type_created_at_idx" ON "usage_analytics"("user_id", "event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "usage_analytics_created_at_idx" ON "usage_analytics"("created_at" DESC);

-- CreateIndex
CREATE INDEX "user_api_keys_user_id_idx" ON "user_api_keys"("user_id");

-- CreateIndex
CREATE INDEX "user_api_keys_user_id_is_active_idx" ON "user_api_keys"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "webhook_requests_created_at_idx" ON "webhook_requests"("created_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_requests_webhook_id_created_at_idx" ON "webhook_requests"("webhook_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "webhooks_is_active_idx" ON "webhooks"("is_active");

-- CreateIndex
CREATE INDEX "workflow_executions_started_at_idx" ON "workflow_executions"("started_at" DESC);

-- CreateIndex
CREATE INDEX "workflow_executions_user_id_status_started_at_idx" ON "workflow_executions"("user_id", "status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "workflow_loops_status_idx" ON "workflow_loops"("status");

-- CreateIndex
CREATE INDEX "workflow_schedules_is_active_next_run_idx" ON "workflow_schedules"("is_active", "next_run");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE INDEX "workflows_user_id_status_idx" ON "workflows"("user_id", "status");

-- AddForeignKey
ALTER TABLE "health_goals" ADD CONSTRAINT "health_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
