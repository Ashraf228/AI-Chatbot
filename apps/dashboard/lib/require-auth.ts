import { NextResponse } from "next/server";
import { getDashboardSession, type DashboardSession } from "@/lib/auth";

type RequireAuthOptions = {
  allowCustomer?: boolean;
};

export async function requireAuth(options: RequireAuthOptions = {}) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!options.allowCustomer && session.role !== "admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function requireSession(
  options: RequireAuthOptions = {}
): Promise<
  | {
      session: DashboardSession;
      response: null;
    }
  | {
      session: null;
      response: NextResponse;
    }
> {
  const session = await getDashboardSession();

  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!options.allowCustomer && session.role !== "admin") {
    return {
      session: null,
      response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    session,
    response: null,
  };
}
