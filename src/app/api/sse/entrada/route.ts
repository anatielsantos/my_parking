import { createSSEHandler } from "use-next-sse";
import QRCode from "qrcode";
import { createPrepareEntryUseCase } from "@/lib/use-cases/factory";
import { NoAvailableSpotsError } from "@/lib/use-cases/prepare-entry";
import { entradaEventEmitter, ENTRADA_EVENT } from "@/lib/sse/entrada-emitter";
import { BASE_URL } from "@/lib/constants";

/**
 * @swagger
 * /api/sse/entrada:
 *   get:
 *     summary: SSE — recebe QR codes em tempo real
 *     description: |
 *       Conexao SSE (Server-Sent Events) de longa duracao. **Ao conectar, a primeira vaga disponivel ja e enviada imediatamente como evento `vaga_ocupada`.**
 *
 *       A cada escaneamento de QR na entrada, um novo evento e enviado com a proxima vaga disponivel.
 *
 *       Quando nao ha vagas, um evento `error` e enviado mas a **conexao permanece aberta**, aguardando uma saida liberar vaga.
 *     responses:
 *       200:
 *         description: Conexao SSE estabelecida. Eventos enviados em text/event-stream.
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: object
 *               properties:
 *                 event:
 *                   type: string
 *                   enum: [vaga_ocupada, error]
 *                 data:
 *                   oneOf:
 *                     - type: object
 *                       description: Payload do evento vaga_ocupada
 *                       properties:
 *                         spot:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             code:
 *                               type: integer
 *                             status:
 *                               type: string
 *                         token:
 *                           type: string
 *                           format: uuid
 *                         qrDataUrl:
 *                           type: string
 *                           description: QR code em formato data URI (base64 PNG).
 *                     - type: object
 *                       description: Payload do evento error
 *                       properties:
 *                         error:
 *                           type: string
 *     headers:
 *       Content-Type:
 *         schema:
 *           type: string
 *           default: text/event-stream
 *       Cache-Control:
 *         schema:
 *           type: string
 *           default: no-cache
 *       Connection:
 *         schema:
 *           type: string
 *           default: keep-alive
 */
export const dynamic = "force-dynamic";

export const GET = createSSEHandler((send, close, { onClose }) => {
  let closed = false;

  onClose(() => {
    closed = true;
  });

  const prepareEntry = createPrepareEntryUseCase();

  const run = async () => {
    try {
      while (!closed) {
        try {
          const { spot, token } = await prepareEntry.execute();
          const confirmUrl = `${BASE_URL}/entrada/confirmar?token=${token}`;
          const qrDataUrl = await QRCode.toDataURL(confirmUrl);

          send({ spot, token, qrDataUrl }, ENTRADA_EVENT);
        } catch (error) {
          if (error instanceof NoAvailableSpotsError && !closed) {
            send({ error: "Nao ha vagas disponiveis no momento" }, "error");
          }
        }

        if (closed) break;

        await new Promise<void>((resolve) => {
          entradaEventEmitter.once(ENTRADA_EVENT, () => {
            if (!closed) resolve();
          });
        });
      }
    } finally {
      if (!closed) close();
    }
  };

  run();
});
