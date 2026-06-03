import { NextRequest, NextResponse } from "next/server";
import { createGetAllSpotsUseCase } from "@/lib/use-cases/factory";
import { protectRoute } from "@/lib/auth";

/**
 * @swagger
 * /api/vagas:
 *   get:
 *     summary: Lista todas as vagas
 *     description: Retorna todas as vagas do estacionamento com codigo e status. Requer autenticacao de administrador via cookie auth_token (JWT httpOnly).
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de vagas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total:
 *                   type: integer
 *                 spots:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       code:
 *                         type: integer
 *                       status:
 *                         type: string
 *                         enum: [disponivel, ocupada]
 *       401:
 *         description: Nao autorizado (cookie ausente ou invalido).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Erro interno ao buscar vagas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 */
export async function GET(request: NextRequest) {
  const authResponse = await protectRoute(request);
  if (authResponse) return authResponse;

  try {
    const useCase = createGetAllSpotsUseCase();
    const result = await useCase.execute();

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false, error: "Erro ao buscar vagas" },
      { status: 500 },
    );
  }
}
