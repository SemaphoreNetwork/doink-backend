import { Static, Type } from "@sinclair/typebox";
import fastify, { FastifyInstance, FastifyReply } from "fastify";
import * as dotenv from "dotenv";

// import DoinkContract from "../artifacts/sepolia/Doink.sol/Doink.json" with { type: "json" };

dotenv.config();

const MintRequestSchema = Type.Object({
  address: Type.String(),
});
type MintRequest = Static<typeof MintRequestSchema>;

type SemaphoreError = {
  message: string;
  type: string;
  context: any;
  stack?: string;
};

type ServerConfig = {
  adminToken: string;
  port: number;
  host: string;
};

/**
 * Converts an error into a json-like object.
 *
 * @param error - Error to convert.
 * @returns SemaphoreError object.
 */
const formatError = (error: Error): SemaphoreError => {
  return {
    message: error.message,
    type: error.name,
    context: {},
    stack: error.stack,
  };
};

const api = {
  auth: {},
  get: {
    ping: async (res: FastifyReply) => {
      return res.status(200).send("pong\n");
    },
    doink: async (res: FastifyReply) => {
      try {
        // TODO: Get the current doink mint nonce.
        return res.status(200).send(JSON.stringify({ id: 1 }));
      } catch (e) {
        const json = formatError(e);
        return res.status(500).send(json);
      }
    },
  },
  post: {
    mint: async (body: MintRequest, res: FastifyReply) => {
      try {
        const { address } = body;
        // TODO: Mint the doink
        res.status(200).send(
          JSON.stringify({
            id: 1, //id,
          })
        );
      } catch (e) {
        const json = formatError(e);
        return res.status(500).send(json);
      }
    },
  },
};

async function main() {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("No mnemonic found. Please define MNEMONIC in .env.");
  }

  const config: ServerConfig = {
    adminToken: process.env.ADMIN_TOKEN ?? "doink",
    port: parseInt(process.env.PORT ?? "3000"),
    host: process.env.HOST ?? "localhost",
  };
  const server: FastifyInstance = fastify();

  server.get("/ping", (_, res) => api.get.ping(res));

  server.get("/doink", (_, res) => api.get.doink(res));

  server.post<{ Body: MintRequest }>(
    "/doink",
    { schema: { body: MintRequestSchema } },
    async (req, res) => api.post.mint(req.body, res)
  );

  const address = await server.listen({
    port: config.port,
    host: config.host,
  });
  console.log(`Server listening at ${address}`);
}

main();
