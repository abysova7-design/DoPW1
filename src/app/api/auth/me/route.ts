import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: user.id,
      nickname: user.nickname,
      isAdmin: user.isAdmin,
      isDispatcher: user.isDispatcher,
      positionRank: user.positionRank,
      department: user.department,
      displayName: user.displayName,
      xp: user.xp,
      level: user.level,
      towTruckCert: user.towTruckCert,
      driverCert: user.driverCert,
    },
  });
}
