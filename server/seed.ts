import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  try {
    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin123@gmail.com"));

    if (existingAdmin.length > 0) {
      console.log("[seed] Admin account already exists");
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Insert admin user
    await db.insert(users).values({
      name: "Admin User",
      email: "admin123@gmail.com",
      password: hashedPassword,
      role: "admin",
      status: "active",
    });

    console.log("[seed] Admin account created successfully");
    console.log("[seed] Email: admin123@gmail.com");
    console.log("[seed] Password: admin123");
  } catch (error: any) {
    console.error("[seed] Error seeding database:", error.message);
  }
}
