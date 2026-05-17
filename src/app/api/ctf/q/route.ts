import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/email-allowlist";
import { FLAGS } from "@/lib/ctf/flags";

// Minimal hand-rolled GraphQL-like endpoint. Supports just enough of the
// introspection protocol to reveal that a `vault` field exists, with a
// description telling the player what they need to compute. The description
// itself is the side-channel: the schema documents the secret.
//
// Solution path (intended):
//   1. POST introspection query  → discover the `vault` field
//   2. Read its description      → "SHA-256 hex of 'veevee says hello'"
//   3. Compute the digest        → 64-char hex
//   4. POST { vault(answer: "...") { } } → flag in response

const PASSPHRASE = "veevee says hello";
const EXPECTED_ANSWER = createHash("sha256").update(PASSPHRASE).digest("hex");

const SCHEMA_RESPONSE = {
  __schema: {
    queryType: { name: "Query" },
    types: [
      {
        name: "Query",
        kind: "OBJECT",
        description: "Recon vault. Exactly one field works — find it.",
        fields: [
          {
            name: "vault",
            description:
              "Returns the recon flag when `answer` equals the lowercase " +
              "SHA-256 hex digest of the phrase 'veevee says hello' " +
              "(no quotes, no trailing newline).",
            args: [
              {
                name: "answer",
                description: "64-char lowercase hex",
                type: { kind: "SCALAR", name: "String" },
                defaultValue: null,
              },
            ],
            type: { kind: "SCALAR", name: "String" },
          },
        ],
      },
      { name: "String", kind: "SCALAR", description: "Built-in scalar" },
    ],
  },
};

function unauthorized() {
  return NextResponse.json({ errors: [{ message: "unauthorized" }] }, {
    status: 401,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email || !isAllowedEmail(email)) {
    return unauthorized();
  }

  let body: { query?: unknown; variables?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errors: [{ message: "expected application/json with a query field" }] },
      { status: 400 }
    );
  }

  const query = typeof body.query === "string" ? body.query : "";
  const variables = body.variables ?? {};

  if (!query) {
    return NextResponse.json(
      { errors: [{ message: "missing query" }] },
      { status: 400 }
    );
  }

  // Introspection — any query that asks for __schema gets the schema dump.
  if (query.includes("__schema")) {
    return NextResponse.json({ data: SCHEMA_RESPONSE });
  }

  // Vault query — accept the answer via either inline string or variables.
  if (/\bvault\b/.test(query)) {
    const inline = query.match(/answer:\s*"([^"]*)"/)?.[1];
    const fromVars =
      typeof variables.answer === "string" ? variables.answer : undefined;
    const supplied = (fromVars ?? inline ?? "").trim().toLowerCase();
    if (supplied === EXPECTED_ANSWER) {
      return NextResponse.json({ data: { vault: FLAGS.graphql.code } });
    }
    return NextResponse.json({
      data: { vault: null },
      errors: [{ message: "answer does not match" }],
    });
  }

  return NextResponse.json({
    errors: [{ message: "field not found — try introspection" }],
  });
}

// GET on the same path returns a hint banner. Real GraphQL servers usually
// host GraphiQL here; we serve a one-line breadcrumb instead.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email || !isAllowedEmail(email)) {
    return unauthorized();
  }
  return new Response(
    "POST a GraphQL query here. Start with `{ __schema { types { name fields { name description } } } }`.\n",
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
