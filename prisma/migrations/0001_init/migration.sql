-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LAB_REPORT', 'PRESCRIPTION', 'MEAL_PHOTO', 'HEALTH_EXPORT', 'GENERAL');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('CAMERA_UPLOAD', 'FILE_UPLOAD', 'HEALTHKIT_IMPORT', 'MANUAL_ENTRY', 'CHAT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'QUEUED', 'PROCESSING', 'OCR_COMPLETED', 'EXTRACTED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "LabResultType" AS ENUM ('HBA1C', 'GLUCOSE', 'FASTING_GLUCOSE', 'POSTPRANDIAL_GLUCOSE', 'INSULIN', 'C_PEPTIDE', 'LDL', 'HDL', 'TRIGLYCERIDES', 'CREATININE', 'ALT', 'AST', 'OTHER');

-- CreateEnum
CREATE TYPE "LabResultStatus" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('GLUCOSE', 'MEAL', 'SLEEP', 'INSULIN', 'LAB', 'ACTIVITY', 'HEART_RATE', 'NOTE');

-- CreateEnum
CREATE TYPE "TimelineSourceKind" AS ENUM ('LAB_RESULT', 'MEAL', 'HEALTHKIT', 'MANUAL', 'AI_EXTRACTION', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "HealthMetricType" AS ENUM ('GLUCOSE', 'INSULIN', 'STEPS', 'WEIGHT', 'SLEEP', 'HEART_RATE', 'ACTIVE_ENERGY', 'DIETARY_CARBS');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('GLUCOSE_PATTERN', 'MEAL_IMPACT', 'SPIKE_RISK', 'LAB_TREND', 'ADHERENCE');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MealStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MealAiDispatchStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "GeneratedPlanType" AS ENUM ('FITNESS', 'MEAL');

-- CreateEnum
CREATE TYPE "GeneratedPlanStatus" AS ENUM ('GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "device_binding_enabled" BOOLEAN NOT NULL DEFAULT true,
    "profile" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ios',
    "name" TEXT,
    "metadata" JSONB,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "source" "DocumentSource" NOT NULL DEFAULT 'FILE_UPLOAD',
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "cloudinary_url" TEXT NOT NULL,
    "cloudinary_public_id" TEXT NOT NULL,
    "metadata" JSONB,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "extracted_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_raw" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "raw_text_encrypted" TEXT,
    "normalized_json" JSONB,
    "ai_response_encrypted" TEXT,
    "schema_version" TEXT NOT NULL DEFAULT 'v1',
    "ocr_provider" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_raw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "visit_date" TIMESTAMP(3),
    "doctor_name" TEXT,
    "specialty" TEXT,
    "clinic_name" TEXT,
    "diagnoses" JSONB,
    "complaints" JSONB,
    "medications" JSONB,
    "recommendations" JSONB,
    "follow_up_actions" JSONB,
    "next_visit_date" TIMESTAMP(3),
    "confidence" DECIMAL(5,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "LabResultType" NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "raw_name" TEXT,
    "value" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "reference_range" JSONB,
    "status" "LabResultStatus" NOT NULL DEFAULT 'UNKNOWN',
    "confidence" DECIMAL(5,4) NOT NULL,
    "source_document_id" TEXT,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TimelineEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "source_kind" "TimelineSourceKind" NOT NULL,
    "source_id" TEXT,
    "confidence" DECIMAL(5,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photo_url" TEXT,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "status" "MealStatus" NOT NULL DEFAULT 'COMPLETED',
    "ai_dispatch_status" "MealAiDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "ai_dispatched_at" TIMESTAMP(3),
    "ai_dispatch_failed_at" TIMESTAMP(3),
    "ai_dispatch_failure_reason" TEXT,
    "calories" DECIMAL(12,2),
    "carbohydrates" DECIMAL(12,2),
    "protein" DECIMAL(12,2),
    "fat" DECIMAL(12,2),
    "fiber" DECIMAL(12,2),
    "xe" DECIMAL(12,2),
    "glycemic_index" DECIMAL(12,2),
    "glycemic_load" DECIMAL(12,2),
    "confidence" DECIMAL(5,4),
    "summary" TEXT,
    "recommendations" JSONB,
    "failure_reason" TEXT,
    "metadata" JSONB,
    "source_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_components" (
    "id" TEXT NOT NULL,
    "meal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "description" TEXT,
    "source_document_id" TEXT,
    "title" TEXT,
    "summary" TEXT,
    "calories" DECIMAL(12,2),
    "carbohydrates" DECIMAL(12,2),
    "protein" DECIMAL(12,2),
    "fat" DECIMAL(12,2),
    "fiber" DECIMAL(12,2),
    "xe" DECIMAL(12,2),
    "glycemic_index" DECIMAL(12,2),
    "glycemic_load" DECIMAL(12,2),
    "confidence" DECIMAL(5,4),
    "analysis" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "HealthMetricType" NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "source_app" TEXT,
    "external_id" TEXT,
    "sampled_at" TIMESTAMP(3) NOT NULL,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "severity" "InsightSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "GeneratedPlanType" NOT NULL,
    "status" "GeneratedPlanStatus" NOT NULL DEFAULT 'GENERATED',
    "week_start" TIMESTAMP(3) NOT NULL,
    "week_end" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "preferences" JSONB,
    "model" TEXT,
    "failure_reason" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "device_id" TEXT,
    "ip_address" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "user_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content_encrypted" TEXT NOT NULL,
    "structuredContext" JSONB,
    "citations" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "devices_device_id_idx" ON "devices"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_device_id_key" ON "devices"("user_id", "device_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_device_id_idx" ON "refresh_sessions"("user_id", "device_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_expires_at_idx" ON "refresh_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "documents_user_id_status_uploaded_at_idx" ON "documents"("user_id", "status", "uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_raw_document_id_key" ON "document_raw"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_notes_source_document_id_key" ON "doctor_notes"("source_document_id");

-- CreateIndex
CREATE INDEX "doctor_notes_user_id_visit_date_idx" ON "doctor_notes"("user_id", "visit_date");

-- CreateIndex
CREATE INDEX "lab_results_user_id_measured_at_idx" ON "lab_results"("user_id", "measured_at");

-- CreateIndex
CREATE INDEX "lab_results_user_id_type_measured_at_idx" ON "lab_results"("user_id", "type", "measured_at");

-- CreateIndex
CREATE INDEX "timeline_events_user_id_start_at_idx" ON "timeline_events"("user_id", "start_at");

-- CreateIndex
CREATE INDEX "timeline_events_user_id_type_start_at_idx" ON "timeline_events"("user_id", "type", "start_at");

-- CreateIndex
CREATE INDEX "meals_user_id_logged_at_idx" ON "meals"("user_id", "logged_at");

-- CreateIndex
CREATE INDEX "meal_components_user_id_meal_id_idx" ON "meal_components"("user_id", "meal_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_components_meal_id_ordinal_key" ON "meal_components"("meal_id", "ordinal");

-- CreateIndex
CREATE INDEX "health_metrics_user_id_type_sampled_at_idx" ON "health_metrics"("user_id", "type", "sampled_at");

-- CreateIndex
CREATE UNIQUE INDEX "health_metrics_user_id_type_external_id_key" ON "health_metrics"("user_id", "type", "external_id");

-- CreateIndex
CREATE INDEX "insights_user_id_type_generated_at_idx" ON "insights"("user_id", "type", "generated_at");

-- CreateIndex
CREATE INDEX "generated_plans_user_id_type_week_start_idx" ON "generated_plans"("user_id", "type", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "generated_plans_user_id_type_week_start_key" ON "generated_plans"("user_id", "type", "week_start");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "assistant_conversations_user_id_updated_at_idx" ON "assistant_conversations"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "assistant_messages_user_id_created_at_idx" ON "assistant_messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "assistant_messages_conversation_id_created_at_idx" ON "assistant_messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_raw" ADD CONSTRAINT "document_raw_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_notes" ADD CONSTRAINT "doctor_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_notes" ADD CONSTRAINT "doctor_notes_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_components" ADD CONSTRAINT "meal_components_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_components" ADD CONSTRAINT "meal_components_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_metrics" ADD CONSTRAINT "health_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_plans" ADD CONSTRAINT "generated_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

