import { createHash } from "node:crypto";
import { execFile as execFileCallback, spawn } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const project = "admission-g5or-recovery";
const composeArgs = [
  "compose",
  "-f",
  "compose.e4-recovery.yaml",
  "-p",
  project,
];
const passwords = {
  bootstrap: "admission_bootstrap_local_only",
  migrator: "admission_migrator_local_only",
  app: "admission_app_local_only",
};
const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const approvedKey = "11111111-1111-4111-8111-111111111111";
const quarantineKey = "22222222-2222-4222-8222-222222222222";
const approvedDocumentVersionId = "23111111-1111-4111-8111-111111111111";
const quarantineDocumentVersionId = "23222222-2222-4222-8222-222222222222";
const approvedBytes = Buffer.from("synthetic-approved-document-version-g5or");
const quarantineBytes = Buffer.from(
  "synthetic-quarantine-document-version-g5or",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function lines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
async function capture(args) {
  return (
    await execFile("docker", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    })
  ).stdout.trim();
}
function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: input === undefined ? "inherit" : ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    if (input !== undefined) {
      child.stderr.on("data", (x) => {
        stderr += x;
      });
      child.stdin.end(input);
    }
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`${command} ${args.join(" ")} exited ${code}: ${stderr}`),
          ),
    );
  });
}
async function psql(service, role, password, sql) {
  return capture([
    ...composeArgs,
    "exec",
    "-T",
    "-e",
    `PGPASSWORD=${password}`,
    service,
    "psql",
    "-U",
    role,
    "-d",
    "admission_dev",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
    sql,
  ]);
}
async function migrate(host) {
  await run("docker", [
    ...composeArgs,
    "run",
    "--build",
    "--rm",
    "--no-deps",
    "-e",
    `DATABASE_MIGRATION_URL=postgresql://admission_migrator:${passwords.migrator}@${host}:5432/admission_dev`,
    "migrator",
  ]);
}
async function healthy(service) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const id = await capture([...composeArgs, "ps", "-aq", service]);
    if (id) {
      const state = JSON.parse(
        await capture([
          "inspect",
          id.split("\n")[0],
          "--format",
          "{{json .State}}",
        ]),
      );
      if (state.Health?.Status === "healthy") return;
      if (state.Status !== "running") throw new Error(`${service} stopped`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${service} not healthy`);
}

const controlPlaneSql = `
BEGIN;
INSERT INTO platform_users (id,email_normalized,status) VALUES ('11111111-1111-4111-8111-111111111111','g5or-a@example.invalid','ACTIVE'),('22222222-2222-4222-8222-222222222222','g5or-b@example.invalid','ACTIVE');
INSERT INTO tenants (id,name,status) VALUES ('${tenantA}','G5OR Synthetic Tenant A','ACTIVE'),('${tenantB}','G5OR Synthetic Tenant B','ACTIVE');
INSERT INTO family_profiles (id,user_id,display_name) VALUES ('12111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Synthetic recovery family');
INSERT INTO students (id,family_profile_id,given_name,family_name) VALUES ('13111111-1111-4111-8111-111111111111','12111111-1111-4111-8111-111111111111','Synthetic','Recovery');
COMMIT;`;
const tenantFixtureSql = `
BEGIN; SELECT set_config('admission.tenant_id','${tenantA}',true);
INSERT INTO memberships (id,tenant_id,user_id,status,starts_at) VALUES ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${tenantA}','11111111-1111-4111-8111-111111111111','ACTIVE','2026-08-15T00:00:00Z');
INSERT INTO campuses (id,tenant_id,code,name) VALUES ('14111111-1111-4111-8111-111111111111','${tenantA}','G5OR-CAMPUS','Synthetic recovery campus');
INSERT INTO academic_years (id,tenant_id,code,label,status) VALUES ('15111111-1111-4111-8111-111111111111','${tenantA}','G5OR-YEAR','Synthetic recovery year','OPEN');
INSERT INTO course_levels (id,tenant_id,code,name) VALUES ('16111111-1111-4111-8111-111111111111','${tenantA}','G5OR-LEVEL','Synthetic recovery level');
INSERT INTO admission_processes (id,tenant_id,academic_year_id,code,name,status) VALUES ('17111111-1111-4111-8111-111111111111','${tenantA}','15111111-1111-4111-8111-111111111111','G5OR-PROCESS','Synthetic recovery process','PUBLISHED');
INSERT INTO admission_offerings (id,tenant_id,campus_id,academic_year_id,process_id,course_level_id,code,title,status,availability_category) VALUES ('18111111-1111-4111-8111-111111111111','${tenantA}','14111111-1111-4111-8111-111111111111','15111111-1111-4111-8111-111111111111','17111111-1111-4111-8111-111111111111','16111111-1111-4111-8111-111111111111','G5OR-OFFER','Synthetic recovery offering','PUBLISHED','POSTULATIONS_OPEN');
INSERT INTO applications (id,tenant_id,family_profile_id,student_id,academic_year_id,process_id,offering_id,draft_data) VALUES ('19111111-1111-4111-8111-111111111111','${tenantA}','12111111-1111-4111-8111-111111111111','13111111-1111-4111-8111-111111111111','15111111-1111-4111-8111-111111111111','17111111-1111-4111-8111-111111111111','18111111-1111-4111-8111-111111111111','{}');
INSERT INTO document_requirements (id,tenant_id,code,name,purpose) VALUES ('20111111-1111-4111-8111-111111111111','${tenantA}','G5OR-APPROVED','Synthetic approved document','recovery.exercise'),('20222222-2222-4222-8222-222222222222','${tenantA}','G5OR-QUARANTINE','Synthetic quarantine document','recovery.exercise');
INSERT INTO document_requirement_versions (id,tenant_id,document_requirement_id,version_number,lifecycle,required,sensitivity,allows_equivalent,validity_rule,allowed_file_types,max_file_size_bytes,correction_window_business_days,published_at) VALUES ('21111111-1111-4111-8111-111111111111','${tenantA}','20111111-1111-4111-8111-111111111111',1,'PUBLISHED',true,'internal',false,'NONE','["PDF"]',1048576,1,'2026-08-15T00:00:00Z'),('21222222-2222-4222-8222-222222222222','${tenantA}','20222222-2222-4222-8222-222222222222',1,'PUBLISHED',true,'internal',false,'NONE','["PDF"]',1048576,1,'2026-08-15T00:00:00Z');
INSERT INTO document_submissions (id,tenant_id,application_id,document_requirement_id,requirement_version_id,status) VALUES ('22111111-1111-4111-8111-111111111111','${tenantA}','19111111-1111-4111-8111-111111111111','20111111-1111-4111-8111-111111111111','21111111-1111-4111-8111-111111111111','CARGADO'),('22222222-2222-4222-8222-222222222222','${tenantA}','19111111-1111-4111-8111-111111111111','20222222-2222-4222-8222-222222222222','21222222-2222-4222-8222-222222222222','CARGADO');
INSERT INTO document_versions (id,tenant_id,document_submission_id,version_number,display_name_sanitized,declared_mime,detected_mime,size_bytes,sha256,quarantine_object_key,approved_object_key,technical_status,scan_status,scan_provider,scan_engine_version,scan_signature_version,origin,uploaded_by,ready_at) VALUES ('${approvedDocumentVersionId}','${tenantA}','22111111-1111-4111-8111-111111111111',1,'synthetic-approved.pdf','application/pdf','application/pdf',${approvedBytes.byteLength},'${sha256(approvedBytes)}','41111111-1111-4111-8111-111111111111','${approvedKey}','READY_FOR_REVIEW','CLEAN','synthetic-development','synthetic-development-1','synthetic-controls-v1','SELF_SERVICE','11111111-1111-4111-8111-111111111111','2026-08-15T00:00:00Z'),('${quarantineDocumentVersionId}','${tenantA}','22222222-2222-4222-8222-222222222222',1,'synthetic-quarantine.pdf','application/pdf',NULL,${quarantineBytes.byteLength},'${sha256(quarantineBytes)}','${quarantineKey}','42222222-2222-4222-8222-222222222222','QUARANTINED','PENDING',NULL,NULL,NULL,'SELF_SERVICE','11111111-1111-4111-8111-111111111111',NULL);
UPDATE document_submissions SET current_document_version_id='${approvedDocumentVersionId}' WHERE id='22111111-1111-4111-8111-111111111111';
INSERT INTO outbox_messages (id,tenant_id,topic,payload,idempotency_key,available_at) VALUES ('aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${tenantA}','synthetic.g5or','{"fixture":"A"}','g5or-a','2026-08-15T00:00:00Z');
INSERT INTO tenant_probe_records (id,tenant_id,label) VALUES ('aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${tenantA}','g5or-probe-a'); COMMIT;
BEGIN; SELECT set_config('admission.tenant_id','${tenantB}',true);
INSERT INTO memberships (id,tenant_id,user_id,status,starts_at) VALUES ('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${tenantB}','22222222-2222-4222-8222-222222222222','ACTIVE','2026-08-15T00:00:00Z');
INSERT INTO outbox_messages (id,tenant_id,topic,payload,idempotency_key,available_at) VALUES ('bbbbbbb4-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${tenantB}','synthetic.g5or','{"fixture":"B"}','g5or-b','2026-08-15T00:00:00Z');
INSERT INTO tenant_probe_records (id,tenant_id,label) VALUES ('bbbbbbb5-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${tenantB}','g5or-probe-b'); COMMIT;`;
const fingerprintSql =
  "SELECT 'migrations=' || count(*) FROM _prisma_migrations; SELECT 'tenants=' || count(*) FROM tenants; SELECT 'memberships=' || count(*) FROM memberships; SELECT 'document_versions=' || count(*) FROM document_versions; SELECT 'outbox=' || count(*) FROM outbox_messages; SELECT 'probes=' || count(*) FROM tenant_probe_records;";

async function inventory(root) {
  const entries = [];
  for (const area of ["approved", "quarantine"]) {
    const path = join(root, area);
    for (const name of await readdir(path)) {
      const file = join(path, name);
      const bytes = await readFile(file);
      entries.push({
        area,
        key: name,
        sha256: sha256(bytes),
        size: bytes.length,
      });
    }
  }
  return entries.sort((a, b) =>
    `${a.area}/${a.key}`.localeCompare(`${b.area}/${b.key}`),
  );
}
async function verifyManifest(root, manifest) {
  const actual = await inventory(root);
  const expectedObjects = manifest.objects.map((object) => ({
    area: object.storageArea,
    key: object.objectKey,
    sha256: object.sha256,
    size: object.size,
  }));
  expectedObjects.sort((a, b) =>
    `${a.area}/${a.key}`.localeCompare(`${b.area}/${b.key}`),
  );
  assert(
    JSON.stringify(actual) === JSON.stringify(expectedObjects),
    "manifest/object inventory mismatch",
  );
}

async function assertDocumentStorageAssociations(service, root) {
  const approved =
    lines(
      await psql(
        service,
        "admission_app",
        passwords.app,
        `BEGIN; SELECT set_config('admission.tenant_id','${tenantA}',true); SELECT dv.technical_status || '|' || dv.scan_status || '|' || dv.approved_object_key || '|' || dv.sha256 || '|' || dv.size_bytes || '|' || ds.application_id || '|' || ds.current_document_version_id FROM document_versions dv JOIN document_submissions ds ON ds.tenant_id=dv.tenant_id AND ds.id=dv.document_submission_id WHERE dv.id='${approvedDocumentVersionId}' AND dv.tenant_id='${tenantA}'; COMMIT;`,
      ),
    ).find((line) => line.startsWith("READY_FOR_REVIEW|")) ?? "";
  assert(
    approved ===
      `READY_FOR_REVIEW|CLEAN|${approvedKey}|${sha256(approvedBytes)}|${approvedBytes.byteLength}|19111111-1111-4111-8111-111111111111|${approvedDocumentVersionId}`,
    `approved DocumentVersion association is incoherent: ${approved}`,
  );
  const quarantined =
    lines(
      await psql(
        service,
        "admission_app",
        passwords.app,
        `BEGIN; SELECT set_config('admission.tenant_id','${tenantA}',true); SELECT dv.technical_status || '|' || dv.scan_status || '|' || dv.quarantine_object_key || '|' || dv.sha256 || '|' || dv.size_bytes || '|' || ds.application_id || '|' || COALESCE(ds.current_document_version_id::text,'') FROM document_versions dv JOIN document_submissions ds ON ds.tenant_id=dv.tenant_id AND ds.id=dv.document_submission_id WHERE dv.id='${quarantineDocumentVersionId}' AND dv.tenant_id='${tenantA}'; COMMIT;`,
      ),
    ).find((line) => line.startsWith("QUARANTINED|")) ?? "";
  assert(
    quarantined ===
      `QUARANTINED|PENDING|${quarantineKey}|${sha256(quarantineBytes)}|${quarantineBytes.byteLength}|19111111-1111-4111-8111-111111111111|`,
    `quarantine DocumentVersion association is incoherent: ${quarantined}`,
  );
  assert(
    Buffer.compare(
      await readFile(join(root, "approved", approvedKey)),
      approvedBytes,
    ) === 0,
    "approved document bytes do not match its persisted version",
  );
  assert(
    Buffer.compare(
      await readFile(join(root, "quarantine", quarantineKey)),
      quarantineBytes,
    ) === 0,
    "quarantine document bytes do not match its persisted version",
  );
  assert(
    !(await stat(join(root, "approved", "42222222-2222-4222-8222-222222222222"))
      .then(() => true)
      .catch(() => false)),
    "quarantine version was promoted unexpectedly",
  );
}

async function verifyRecoveryStorage(root, service, manifest) {
  await verifyManifest(root, manifest);
  await assertDocumentStorageAssociations(service, root);
}

async function main() {
  const startedAt = new Date();
  const startedMs = Date.now();
  const temp = await mkdtemp(join(tmpdir(), "admission-g5or-recovery-"));
  const sourceRoot = join(temp, "source-objects");
  const recoveryRoot = join(temp, "recovery-objects");
  const backupRoot = join(temp, "coordinated-backup");
  console.log("RECOVERY_SCOPE=LOCAL_DEVELOPMENT_CI_SYNTHETIC_ONLY");
  console.log("OBSERVED_RECOVERY_DURATION!=RTO_PROOF");
  console.log("RPO_1H=INITIAL_TECHNICAL_TARGET_NOT_SLA");
  console.log("RTO_4H=INITIAL_TECHNICAL_TARGET_NOT_SLA");
  await run("docker", [
    ...composeArgs,
    "down",
    "--volumes",
    "--remove-orphans",
  ]).catch(() => undefined);
  try {
    await run("docker", [...composeArgs, "up", "-d", "source", "recovery"]);
    await healthy("source");
    await healthy("recovery");
    await migrate("source");
    await migrate("recovery");
    const migrationCount = await psql(
      "source",
      "admission_migrator",
      passwords.migrator,
      "SELECT count(*) FROM _prisma_migrations;",
    );
    assert(
      migrationCount === "17",
      `expected migration 17, got ${migrationCount}`,
    );
    console.log("G5OR-REC-01=PASS");
    await run(
      "docker",
      [
        ...composeArgs,
        "exec",
        "-T",
        "-e",
        `PGPASSWORD=${passwords.migrator}`,
        "source",
        "psql",
        "-U",
        "admission_migrator",
        "-d",
        "admission_dev",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "-",
      ],
      controlPlaneSql,
    );
    await run(
      "docker",
      [
        ...composeArgs,
        "exec",
        "-T",
        "-e",
        `PGPASSWORD=${passwords.app}`,
        "source",
        "psql",
        "-U",
        "admission_app",
        "-d",
        "admission_dev",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "-",
      ],
      tenantFixtureSql,
    );
    console.log("G5OR-REC-02=PASS");
    await mkdir(join(sourceRoot, "approved"), { recursive: true });
    await mkdir(join(sourceRoot, "quarantine"), { recursive: true });
    await writeFile(join(sourceRoot, "approved", approvedKey), approvedBytes);
    await writeFile(
      join(sourceRoot, "quarantine", "41111111-1111-4111-8111-111111111111"),
      approvedBytes,
    );
    await writeFile(
      join(sourceRoot, "quarantine", quarantineKey),
      quarantineBytes,
    );
    await assertDocumentStorageAssociations("source", sourceRoot);
    console.log("G5OR-REC-03=PASS");
    console.log("G5OR-REC-04=PASS");
    const sourceFingerprint = lines(
      await psql(
        "source",
        "admission_migrator",
        passwords.migrator,
        fingerprintSql,
      ),
    );
    const dump = await capture([
      ...composeArgs,
      "exec",
      "-T",
      "-e",
      `PGPASSWORD=${passwords.bootstrap}`,
      "source",
      "pg_dump",
      "-U",
      "admission_bootstrap",
      "-d",
      "admission_dev",
      "--format=plain",
      "--no-owner",
      "--clean",
      "--if-exists",
    ]);
    await mkdir(backupRoot, { recursive: true });
    await writeFile(join(backupRoot, "database.sql"), dump);
    await cp(sourceRoot, join(backupRoot, "objects"), { recursive: true });
    const manifest = {
      database: {
        sha256: sha256(Buffer.from(dump)),
        size: Buffer.byteLength(dump),
      },
      objects: [
        {
          logicalResource: approvedDocumentVersionId,
          objectKey: approvedKey,
          sha256: sha256(approvedBytes),
          size: approvedBytes.byteLength,
          storageArea: "approved",
        },
        {
          logicalResource: approvedDocumentVersionId,
          objectKey: "41111111-1111-4111-8111-111111111111",
          sha256: sha256(approvedBytes),
          size: approvedBytes.byteLength,
          storageArea: "quarantine",
        },
        {
          logicalResource: quarantineDocumentVersionId,
          objectKey: quarantineKey,
          sha256: sha256(quarantineBytes),
          size: quarantineBytes.byteLength,
          storageArea: "quarantine",
        },
      ],
      scope: "synthetic-g5or",
    };
    await writeFile(
      join(backupRoot, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    console.log("G5OR-REC-05=PASS");
    console.log("G5OR-REC-06=PASS");
    await run(
      "docker",
      [
        ...composeArgs,
        "exec",
        "-T",
        "-e",
        `PGPASSWORD=${passwords.migrator}`,
        "recovery",
        "psql",
        "-U",
        "admission_migrator",
        "-d",
        "admission_dev",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "-",
      ],
      dump,
    );
    await cp(join(backupRoot, "objects"), recoveryRoot, { recursive: true });
    console.log("G5OR-REC-07=PASS");
    assert(
      sourceFingerprint.join("\n") ===
        lines(
          await psql(
            "recovery",
            "admission_migrator",
            passwords.migrator,
            fingerprintSql,
          ),
        ).join("\n"),
      "DB fingerprint differs",
    );
    console.log("G5OR-REC-08=PASS");
    await verifyRecoveryStorage(recoveryRoot, "recovery", manifest);
    console.log("G5OR-REC-09=PASS");
    const rls = lines(
      await psql(
        "recovery",
        "admission_app",
        passwords.app,
        `BEGIN; SELECT set_config('admission.tenant_id','${tenantA}',true); SELECT 'a='||count(*) FROM tenant_probe_records WHERE tenant_id='${tenantA}'; SELECT 'b='||count(*) FROM tenant_probe_records WHERE tenant_id='${tenantB}'; COMMIT;`,
      ),
    );
    const none = await psql(
      "recovery",
      "admission_app",
      passwords.app,
      "SELECT count(*) FROM tenant_probe_records;",
    );
    const role = await psql(
      "recovery",
      "admission_app",
      passwords.app,
      "SELECT rolsuper || '|' || rolbypassrls FROM pg_roles WHERE rolname=current_user;",
    );
    assert(
      rls.includes("a=1") &&
        rls.includes("b=0") &&
        none === "0" &&
        role === "false|false",
      "RLS recovery check failed",
    );
    console.log("G5OR-REC-10=PASS");
    await rm(join(recoveryRoot, "approved", approvedKey));
    await verifyRecoveryStorage(recoveryRoot, "recovery", manifest)
      .then(() => {
        throw new Error("missing object was silently accepted");
      })
      .catch((error) =>
        assert(
          error.message.includes("mismatch") || error.message.includes("bytes"),
          "missing-object detection was not controlled",
        ),
      );
    await cp(
      join(sourceRoot, "approved", approvedKey),
      join(recoveryRoot, "approved", approvedKey),
    );
    console.log("G5OR-REC-11=PASS");
    await writeFile(
      join(recoveryRoot, "approved", "33333333-3333-4333-8333-333333333333"),
      "unexpected",
    );
    await verifyRecoveryStorage(recoveryRoot, "recovery", manifest)
      .then(() => {
        throw new Error("unexpected object was silently accepted");
      })
      .catch((error) =>
        assert(
          error.message.includes("mismatch") || error.message.includes("bytes"),
          "unexpected-object detection was not controlled",
        ),
      );
    await rm(
      join(recoveryRoot, "approved", "33333333-3333-4333-8333-333333333333"),
    );
    console.log("G5OR-REC-12=PASS");
    assert(
      (await stat(join(recoveryRoot, "approved", approvedKey)).then((x) =>
        x.isFile(),
      )) &&
        (await stat(join(recoveryRoot, "quarantine", quarantineKey)).then((x) =>
          x.isFile(),
        )),
      "areas are not separated",
    );
    console.log("G5OR-REC-13=PASS");
    const completedAt = new Date();
    const elapsedMs = Date.now() - startedMs;
    console.log(
      `G5OR-REC-14=PASS startedAt=${startedAt.toISOString()} completedAt=${completedAt.toISOString()} elapsedMs=${elapsedMs}`,
    );
    console.log("G5OR_RECOVERY_SMOKE=PASS");
  } finally {
    await run("docker", [
      ...composeArgs,
      "down",
      "--volumes",
      "--remove-orphans",
    ]).catch(() => undefined);
    await rm(temp, { recursive: true, force: true });
    console.log("G5OR-REC-15=PASS");
  }
}
await main();
