import { networkInterfaces } from "node:os";
import { json } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * Dev helper: when the TV is opened at localhost, phones can't scan that, so
 * the lobby asks for this machine's Wi-Fi address to put in the QR code.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return json({ url: null });
  const address = Object.values(networkInterfaces())
    .flat()
    .find((net) => net && net.family === "IPv4" && !net.internal)?.address;
  const { port } = new URL(req.url);
  return json({ url: address ? `http://${address}${port ? `:${port}` : ""}` : null });
}
