using JobSearchAssistant.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JobSearchAssistant.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260906130500_BaselineExistingSchema")]
public sealed class BaselineExistingSchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "AppStates" (
                "Id" integer NOT NULL,
                "HhResumeId" text NOT NULL,
                "ProtectedAccessToken" text NOT NULL,
                "ProtectedRefreshToken" text NOT NULL,
                "AccessTokenExpiresAt" timestamp with time zone NULL,
                "OAuthState" text NOT NULL,
                "OAuthCodeVerifier" text NOT NULL,
                "OAuthCreatedAt" timestamp with time zone NULL,
                "AutoApplyEnabled" boolean NOT NULL,
                "AutoApplyMinimumScore" integer NOT NULL,
                "DailyAutoApplyLimit" integer NOT NULL,
                "LastCollectedAt" timestamp with time zone NULL,
                CONSTRAINT "PK_AppStates" PRIMARY KEY ("Id")
            );

            CREATE TABLE IF NOT EXISTS "Companies" (
                "Id" uuid NOT NULL,
                "Source" text NOT NULL,
                "ExternalId" text NOT NULL,
                "Name" text NOT NULL,
                "IsBlacklisted" boolean NOT NULL,
                "IsWatched" boolean NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_Companies" PRIMARY KEY ("Id")
            );

            CREATE TABLE IF NOT EXISTS "Vacancies" (
                "Id" uuid NOT NULL,
                "Source" text NOT NULL,
                "SourceLabel" text NOT NULL,
                "ExternalId" text NOT NULL,
                "CanonicalFingerprint" text NOT NULL,
                "Title" text NOT NULL,
                "Url" text NOT NULL,
                "ApplyUrl" text NOT NULL,
                "DescriptionText" text NOT NULL,
                "SalaryText" text NOT NULL,
                "Schedule" text NOT NULL,
                "Experience" text NOT NULL,
                "Country" text NOT NULL,
                "LocationText" text NOT NULL,
                "RemoteScope" text NOT NULL,
                "EligibilityStatus" text NOT NULL,
                "EligibilityReason" text NOT NULL,
                "PublishedAt" timestamp with time zone NULL,
                "FirstSeenAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NOT NULL,
                "CompanyId" uuid NOT NULL,
                "MatchScore" integer NOT NULL,
                "MatchLevel" text NOT NULL,
                "MatchedSkills" text NOT NULL,
                "MissingSkills" text NOT NULL,
                "WhyMatch" text NOT NULL,
                "IsRemote" boolean NOT NULL,
                "HasExistingHhResponse" boolean NOT NULL,
                "Status" integer NOT NULL,
                CONSTRAINT "PK_Vacancies" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_Vacancies_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS "Applications" (
                "Id" uuid NOT NULL,
                "VacancyId" uuid NOT NULL,
                "ResumeExternalId" text NOT NULL,
                "CoverLetter" text NOT NULL,
                "AppliedAt" timestamp with time zone NOT NULL,
                "ExternalNegotiationId" text NOT NULL,
                "LastError" text NOT NULL,
                CONSTRAINT "PK_Applications" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_Applications_Vacancies_VacancyId" FOREIGN KEY ("VacancyId") REFERENCES "Vacancies" ("Id") ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS "ApplicationEvents" (
                "Id" uuid NOT NULL,
                "VacancyId" uuid NOT NULL,
                "Type" text NOT NULL,
                "Note" text NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_ApplicationEvents" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_ApplicationEvents_Vacancies_VacancyId" FOREIGN KEY ("VacancyId") REFERENCES "Vacancies" ("Id") ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Companies_Source_ExternalId" ON "Companies" ("Source", "ExternalId");
            CREATE INDEX IF NOT EXISTS "IX_Vacancies_CanonicalFingerprint" ON "Vacancies" ("CanonicalFingerprint");
            CREATE INDEX IF NOT EXISTS "IX_Vacancies_CompanyId" ON "Vacancies" ("CompanyId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Vacancies_Source_ExternalId" ON "Vacancies" ("Source", "ExternalId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Applications_VacancyId" ON "Applications" ("VacancyId");
            CREATE INDEX IF NOT EXISTS "IX_ApplicationEvents_VacancyId" ON "ApplicationEvents" ("VacancyId");

            INSERT INTO "AppStates" (
                "Id", "HhResumeId", "ProtectedAccessToken", "ProtectedRefreshToken",
                "AccessTokenExpiresAt", "OAuthState", "OAuthCodeVerifier", "OAuthCreatedAt",
                "AutoApplyEnabled", "AutoApplyMinimumScore", "DailyAutoApplyLimit", "LastCollectedAt")
            VALUES (1, '', '', '', NULL, '', '', NULL, FALSE, 95, 3, NULL)
            ON CONFLICT ("Id") DO NOTHING;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // This migration intentionally adopts databases that may have been created by EnsureCreated.
        // A destructive automatic rollback could erase real application history, so baseline rollback is a no-op.
    }
}
