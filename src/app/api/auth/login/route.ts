import { NextResponse } from "next/server";
import { findUserByUsername, verifyAndUpgradePassword, createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" },
        { status: 400 }
      );
    }

    const user = findUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const isValid = verifyAndUpgradePassword(user, password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: user.user_id,
      username: user.user_name,
      role: user.user_role,
    });

    const isSecure =
      req.headers.get("x-forwarded-proto") === "https" ||
      process.env.NODE_ENV === "production";

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        userId: user.user_id,
        username: user.user_name,
        role: user.user_role,
      },
    });

    response.cookies.set("storemate_session", token, {
      httpOnly: false,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" },
      { status: 500 }
    );
  }
}
