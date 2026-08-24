import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createAppPrismaClient,
  runWithTenantContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";

import { getRequiredEnvironment } from "./environment.js";

const prisma = createAppPrismaClient();
const pool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
});
const tenantA = randomUUID();
const tenantB = randomUUID();

function context(tenantId: string, actorId: string): TenantExecutionContext {
  return {
    actorId,
    contextOrigin: "synthetic_test",
    correlationId: `e5f-rls-${tenantId}`,
    purpose: "E5F_RLS_TEST",
    source: "authenticated_request",
    tenantId,
  };
}

async function seedTenant(tenantId: string, suffix: string) {
  const ids = Object.fromEntries(
    [
      "user",
      "profile",
      "studentA",
      "studentB",
      "campus",
      "year",
      "level",
      "process",
      "offering",
      "applicationA",
      "applicationB",
      "recommendation",
      "recommendationVersion",
      "decision",
      "decisionVersion",
      "capacity",
      "adjustment",
      "reservation",
      "waitlist",
      "offer",
      "offerVersion",
      "acceptance",
      "withdrawal",
      "authority",
      "authorityReview",
    ].map((key) => [key, randomUUID()]),
  ) as Record<
    | "user"
    | "profile"
    | "studentA"
    | "studentB"
    | "campus"
    | "year"
    | "level"
    | "process"
    | "offering"
    | "applicationA"
    | "applicationB"
    | "recommendation"
    | "recommendationVersion"
    | "decision"
    | "decisionVersion"
    | "capacity"
    | "adjustment"
    | "reservation"
    | "waitlist"
    | "offer"
    | "offerVersion"
    | "acceptance"
    | "withdrawal"
    | "authority"
    | "authorityReview",
    string
  >;
  await pool.query("INSERT INTO tenants (id,name) VALUES ($1,$2)", [
    tenantId,
    `E5-F RLS ${suffix}`,
  ]);
  await pool.query(
    "INSERT INTO platform_users (id,email_normalized) VALUES ($1,$2)",
    [ids.user, `e5f-rls-${suffix}-${ids.user}@example.invalid`],
  );
  await pool.query(
    "INSERT INTO family_profiles (id,user_id,display_name) VALUES ($1,$2,$3)",
    [ids.profile, ids.user, `Familia RLS ${suffix}`],
  );
  await pool.query(
    `INSERT INTO students (id,family_profile_id,given_name,family_name,date_of_birth)
     VALUES ($1,$2,'Estudiante','Uno',DATE '2010-01-01'),($3,$2,'Estudiante','Dos',DATE '2010-01-01')`,
    [ids.studentA, ids.profile, ids.studentB],
  );
  await runWithTenantContext(context(tenantId, ids.user), () =>
    withTenantTransaction(prisma, async (transaction) => {
      const tenantClient = {
        query(sql: string, values: unknown[] = []) {
          return transaction.$executeRawUnsafe(sql, ...values);
        },
      };
      await tenantClient.query(
        "INSERT INTO campuses (id,tenant_id,code,name) VALUES ($1,$2,$3,$4)",
        [ids.campus, tenantId, `E5F-RLS-C-${suffix}`, `Sede ${suffix}`],
      );
      await tenantClient.query(
        "INSERT INTO academic_years (id,tenant_id,code,label,status) VALUES ($1,$2,$3,$4,'OPEN')",
        [ids.year, tenantId, `E5F-RLS-Y-${suffix}`, `Año ${suffix}`],
      );
      await tenantClient.query(
        "INSERT INTO course_levels (id,tenant_id,code,name) VALUES ($1,$2,$3,$4)",
        [ids.level, tenantId, `E5F-RLS-L-${suffix}`, `Nivel ${suffix}`],
      );
      await tenantClient.query(
        `INSERT INTO admission_processes
      (id,tenant_id,academic_year_id,code,name,status)
     VALUES ($1,$2,$3,$4,$5,'PUBLISHED')`,
        [
          ids.process,
          tenantId,
          ids.year,
          `E5F-RLS-P-${suffix}`,
          `Proceso ${suffix}`,
        ],
      );
      await tenantClient.query(
        `INSERT INTO admission_offerings
      (id,tenant_id,campus_id,academic_year_id,process_id,course_level_id,code,title,status,availability_category)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PUBLISHED','POSTULATIONS_OPEN')`,
        [
          ids.offering,
          tenantId,
          ids.campus,
          ids.year,
          ids.process,
          ids.level,
          `E5F-RLS-O-${suffix}`,
          `Oferta ${suffix}`,
        ],
      );
      await tenantClient.query(
        `INSERT INTO applications
      (id,tenant_id,family_profile_id,student_id,academic_year_id,process_id,offering_id,status,draft_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8),
            ($9,$2,$3,$10,$5,$6,$7,'DRAFT',$8)`,
        [
          ids.applicationA,
          tenantId,
          ids.profile,
          ids.studentA,
          ids.year,
          ids.process,
          ids.offering,
          JSON.stringify({
            acknowledgedNoGuarantee: true,
            currentStep: "REVIEW",
          }),
          ids.applicationB,
          ids.studentB,
        ],
      );
      await tenantClient.query(
        `INSERT INTO application_authorities
          (id,tenant_id,application_id,authority_user_id,subject_mode,relationship,authority_basis,status,date_of_birth_snapshot,declared_at,verified_at)
         VALUES ($1,$2,$3,$4,'MINOR_REPRESENTATIVE','MOTHER','PARENT','VERIFIED',DATE '2010-01-01',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [ids.authority, tenantId, ids.applicationA, ids.user],
      );
      await tenantClient.query(
        `INSERT INTO application_authority_reviews
          (id,tenant_id,authority_id,application_id,sequence_number,from_status,to_status,subject_mode,relationship,authority_basis,actor_user_id,concurrency_version)
         VALUES ($1,$2,$3,$4,1,'NOT_DECLARED','DECLARED','MINOR_REPRESENTATIVE','MOTHER','PARENT',$5,1)`,
        [
          ids.authorityReview,
          tenantId,
          ids.authority,
          ids.applicationA,
          ids.user,
        ],
      );
      await tenantClient.query(
        "INSERT INTO admission_recommendations (id,tenant_id,application_id) VALUES ($1,$2,$3)",
        [ids.recommendation, tenantId, ids.applicationB],
      );
      await tenantClient.query(
        `INSERT INTO admission_recommendation_versions
      (id,tenant_id,recommendation_id,application_id,version_number,option,foundation,lifecycle,created_by,submitted_by,submitted_at,evidence_manifest)
     VALUES ($1,$2,$3,$4,1,'RECOMENDAR_ADMISION','Evidencia sintética','SUBMITTED',$5,$5,CURRENT_TIMESTAMP,'{}')`,
        [
          ids.recommendationVersion,
          tenantId,
          ids.recommendation,
          ids.applicationB,
          ids.user,
        ],
      );
      await tenantClient.query(
        "UPDATE admission_recommendations SET current_version_id=$1 WHERE id=$2",
        [ids.recommendationVersion, ids.recommendation],
      );
      await tenantClient.query(
        "INSERT INTO direction_decisions (id,tenant_id,application_id) VALUES ($1,$2,$3)",
        [ids.decision, tenantId, ids.applicationB],
      );
      await tenantClient.query(
        `INSERT INTO direction_decision_versions
      (id,tenant_id,direction_decision_id,application_id,version_number,recommendation_version_id,disposition,decided_by,decided_at,evidence_manifest)
     VALUES ($1,$2,$3,$4,1,$5,'LISTA_DE_ESPERA',$6,CURRENT_TIMESTAMP,'{}')`,
        [
          ids.decisionVersion,
          tenantId,
          ids.decision,
          ids.applicationB,
          ids.recommendationVersion,
          ids.user,
        ],
      );
      await tenantClient.query(
        "UPDATE direction_decisions SET current_version_id=$1 WHERE id=$2",
        [ids.decisionVersion, ids.decision],
      );
      await tenantClient.query(
        `INSERT INTO admission_capacities
      (id,tenant_id,offering_id,configured_capacity)
     VALUES ($1,$2,$3,2)`,
        [ids.capacity, tenantId, ids.offering],
      );
      await tenantClient.query(
        `INSERT INTO admission_capacity_adjustments
      (id,tenant_id,capacity_id,offering_id,previous_value,new_value,actor_id,reason)
     VALUES ($1,$2,$3,$4,1,2,$5,'Ajuste sintético')`,
        [ids.adjustment, tenantId, ids.capacity, ids.offering, ids.user],
      );
      await tenantClient.query(
        `INSERT INTO seat_reservations
      (id,tenant_id,capacity_id,application_id,offering_id,state,reserved_at,committed_at)
     VALUES ($1,$2,$3,$4,$5,'COMMITTED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [
          ids.reservation,
          tenantId,
          ids.capacity,
          ids.applicationA,
          ids.offering,
        ],
      );
      await tenantClient.query(
        `INSERT INTO waitlist_entries
      (id,tenant_id,application_id,offering_id,direction_decision_version_id,state,entered_at,withdrawn_at)
     VALUES ($1,$2,$3,$4,$5,'WITHDRAWN',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [
          ids.waitlist,
          tenantId,
          ids.applicationB,
          ids.offering,
          ids.decisionVersion,
        ],
      );
      await tenantClient.query(
        `INSERT INTO admission_offers
      (id,tenant_id,application_id,offering_id,origin)
     VALUES ($1,$2,$3,$4,'NORMAL')`,
        [ids.offer, tenantId, ids.applicationA, ids.offering],
      );
      await tenantClient.query(
        `INSERT INTO admission_offer_versions
      (id,tenant_id,offer_id,application_id,offering_id,reservation_id,version_number,origin,lifecycle,issued_at,expires_at,issued_by,terminal_at,terminal_reason)
     VALUES ($1,$2,$3,$4,$5,$6,1,'NORMAL','ACCEPTED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '3 days',$7,CURRENT_TIMESTAMP,'FAMILY_ACCEPTED')`,
        [
          ids.offerVersion,
          tenantId,
          ids.offer,
          ids.applicationA,
          ids.offering,
          ids.reservation,
          ids.user,
        ],
      );
      await tenantClient.query(
        "UPDATE admission_offers SET current_version_id=$1 WHERE id=$2",
        [ids.offerVersion, ids.offer],
      );
      await tenantClient.query(
        `INSERT INTO offer_acceptances
      (id,tenant_id,offer_id,offer_version_id,application_id,reservation_id,offering_id,actor_id,accepted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)`,
        [
          ids.acceptance,
          tenantId,
          ids.offer,
          ids.offerVersion,
          ids.applicationA,
          ids.reservation,
          ids.offering,
          ids.user,
        ],
      );
      await tenantClient.query(
        `INSERT INTO application_withdrawals
      (id,tenant_id,application_id,offering_id,actor_id,confirmed_at,waitlist_entry_id)
     VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,$6)`,
        [
          ids.withdrawal,
          tenantId,
          ids.applicationB,
          ids.offering,
          ids.user,
          ids.waitlist,
        ],
      );
    }),
  );
  return { actorId: ids.user, ids };
}

describe.sequential("E5-F tenant RLS and database seals", () => {
  let seedA: Awaited<ReturnType<typeof seedTenant>>;
  let seedB: Awaited<ReturnType<typeof seedTenant>>;

  beforeAll(async () => {
    seedA = await seedTenant(tenantA, "A");
    seedB = await seedTenant(tenantB, "B");
  });

  it("E5F-RLS-01..08: every E5-F table exposes only the active tenant", async () => {
    const counts = await runWithTenantContext(
      context(tenantA, seedA.actorId),
      () =>
        withTenantTransaction(prisma, async (transaction) => ({
          acceptances: await transaction.offerAcceptance.count(),
          adjustments: await transaction.admissionCapacityAdjustment.count(),
          capacities: await transaction.admissionCapacity.count(),
          offers: await transaction.admissionOffer.count(),
          reservations: await transaction.seatReservation.count(),
          versions: await transaction.admissionOfferVersion.count(),
          waitlist: await transaction.waitlistEntry.count(),
          withdrawals: await transaction.applicationWithdrawal.count(),
        })),
    );
    expect(counts).toEqual({
      acceptances: 1,
      adjustments: 1,
      capacities: 1,
      offers: 1,
      reservations: 1,
      versions: 1,
      waitlist: 1,
      withdrawals: 1,
    });
    const crossTenant = await runWithTenantContext(
      context(tenantA, seedA.actorId),
      () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.admissionOffer.findMany({ where: { tenantId: tenantB } }),
        ),
    );
    expect(crossTenant).toEqual([]);
  });

  it("E5F-RLS-09..11: no context denies reads, forged tenant inserts fail, and pooled context does not leak", async () => {
    await expect(prisma.admissionCapacity.findMany()).resolves.toEqual([]);
    await expect(
      runWithTenantContext(context(tenantA, seedA.actorId), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.admissionCapacity.create({
            data: {
              configuredCapacity: 1,
              offeringId: seedB.ids.offering,
              tenantId: tenantB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runWithTenantContext(context(tenantB, seedB.actorId), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.admissionOfferVersion.count(),
        ),
      ),
    ).resolves.toBe(1);
    await expect(prisma.admissionOfferVersion.count()).resolves.toBe(0);
  });

  it("R12-RLS-01..10: authority resources remain tenant-scoped, forced and append-only", async () => {
    const own = await runWithTenantContext(
      context(tenantA, seedA.actorId),
      () =>
        withTenantTransaction(prisma, async (transaction) => ({
          authorities: await transaction.applicationAuthority.findMany(),
          evidence: await transaction.applicationAuthorityEvidence.findMany(),
          reviews: await transaction.applicationAuthorityReview.findMany(),
        })),
    );
    expect(own.authorities.map((row) => row.id)).toEqual([seedA.ids.authority]);
    expect(own.reviews.map((row) => row.id)).toEqual([
      seedA.ids.authorityReview,
    ]);
    expect(own.evidence).toEqual([]);

    await expect(prisma.applicationAuthority.findMany()).resolves.toEqual([]);
    const cross = await runWithTenantContext(
      context(tenantB, seedB.actorId),
      () =>
        withTenantTransaction(prisma, async (transaction) => ({
          authorities: await transaction.applicationAuthority.findMany({
            where: { id: seedA.ids.authority },
          }),
          evidence: await transaction.applicationAuthorityEvidence.findMany({
            where: { authorityId: seedA.ids.authority },
          }),
          reviews: await transaction.applicationAuthorityReview.findMany({
            where: { authorityId: seedA.ids.authority },
          }),
        })),
    );
    expect(cross).toEqual({ authorities: [], evidence: [], reviews: [] });

    await expect(
      runWithTenantContext(context(tenantB, seedB.actorId), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.applicationAuthority.create({
            data: {
              applicationId: seedA.ids.applicationA,
              authorityBasis: "PARENT",
              authorityUserId: seedB.ids.user,
              dateOfBirthSnapshot: new Date("2010-01-01T00:00:00.000Z"),
              declaredAt: new Date(),
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
              tenantId: tenantB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    const deniedUpdate = await runWithTenantContext(
      context(tenantB, seedB.actorId),
      () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.applicationAuthority.updateMany({
            data: { status: "DISPUTED" },
            where: { id: seedA.ids.authority },
          }),
        ),
    );
    expect(deniedUpdate.count).toBe(0);

    await expect(
      runWithTenantContext(context(tenantB, seedB.actorId), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.applicationAuthorityEvidence.create({
            data: {
              applicationId: seedA.ids.applicationA,
              authorityId: seedA.ids.authority,
              documentVersionId: randomUUID(),
              linkedByActorId: seedB.ids.user,
              tenantId: tenantA,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    const pooled = await Promise.all(
      Array.from({ length: 12 }, (_, index) => {
        const tenantId = index % 2 === 0 ? tenantA : tenantB;
        const actorId = index % 2 === 0 ? seedA.actorId : seedB.actorId;
        return runWithTenantContext(context(tenantId, actorId), () =>
          withTenantTransaction(prisma, (transaction) =>
            transaction.applicationAuthority.findMany(),
          ),
        );
      }),
    );
    expect(pooled.filter((rows) => rows.length === 1)).toHaveLength(12);
    expect(
      pooled.filter(
        (rows) => rows.length === 1 && rows[0]?.id === seedA.ids.authority,
      ),
    ).toHaveLength(6);
  });

  it("E5F-DB-01..03: append-only evidence and terminal histories reject mutation", async () => {
    await expect(
      runWithTenantContext(context(tenantA, seedA.actorId), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.offerAcceptance.update({
            data: { actorId: randomUUID() },
            where: { id: seedA.ids.acceptance },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runWithTenantContext(context(tenantA, seedA.actorId), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.applicationWithdrawal.delete({
            where: { id: seedA.ids.withdrawal },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runWithTenantContext(context(tenantA, seedA.actorId), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.admissionOfferVersion.update({
            data: { terminalReason: "FAMILY_DECLINED" },
            where: { id: seedA.ids.offerVersion },
          }),
        ),
      ),
    ).rejects.toThrow();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
});
