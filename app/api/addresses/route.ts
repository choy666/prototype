import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { addresses } from "@/lib/schema";
import { addressSchema } from "@/lib/validations/checkout";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const userAddresses = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, parseInt(session.user.id)))
      .orderBy(addresses.isDefault, addresses.createdAt);

    return NextResponse.json(userAddresses);
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return NextResponse.json(
      { error: "Error al obtener direcciones" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = addressSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Datos de dirección inválidos",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const addressData = validationResult.data;

    // Si se marca como predeterminada, quitar el flag de otras direcciones
    if (addressData.isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, parseInt(session.user.id)));
    }

    const newAddress = await db
      .insert(addresses)
      .values({
        ...addressData,
        userId: parseInt(session.user.id),
        isDefault: addressData.isDefault || false,
      })
      .returning();

    return NextResponse.json(newAddress[0], { status: 201 });
  } catch (error) {
    console.error("Error creating address:", error);
    return NextResponse.json(
      { error: "Error al crear dirección" },
      { status: 500 }
    );
  }
}
