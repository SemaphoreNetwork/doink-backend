import { Static, Type } from "@sinclair/typebox";
import fastify, { FastifyInstance, FastifyReply } from "fastify";
import {
  Wallet,
  JsonRpcProvider,
  Interface,
  TransactionResponse,
  HDNodeWallet,
  ErrorFragment,
  TransactionReceipt,
} from "ethers";
import * as dotenv from "dotenv";

import DoinkContract from "../artifacts/optimism/Doink.sol/Doink.json" with { type: "json" };

if (!(DoinkContract as any).address) {
  throw new Error(
    "Address for Doink contract not provided. Please deploy Doink and add address to artifact file."
  );
}

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

// Used in api below.
const RPC = new JsonRpcProvider("https://eth.public-rpc.com", 1);
if (!process.env.MNEMONIC) {
  throw new Error("`MNEMONIC` must be defined in .env.");
}
const WALLET = Wallet.fromPhrase(process.env.MNEMONIC);

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
        // Derive encoded calldata.
        const iface = new Interface(DoinkContract.abi as any[]);
        const data = iface.encodeFunctionData("nextDoink", []);
        // Format transaction.
        const tx = {
          to: DoinkContract.address,
          data,
          chainId: 1,
        };
        // Get the current doink mint nonce.
        const result = await RPC.call(tx);
        return res.status(200).send(JSON.stringify({ id: parseInt(result) }));
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
        // Derive encoded calldata.
        const iface = new Interface(DoinkContract.abi as any[]);
        const data = iface.encodeFunctionData("mint", [address]);
        // Format transaction.
        const tx = {
          to: DoinkContract.address,
          data,
          chainId: 1,
        };

        // Mint the doink
        const result: TransactionResponse = await WALLET.sendTransaction(tx);
        const receipt: TransactionReceipt | null = await result.wait();
        if (receipt) {
          const mintedId = res.status(200).send(
            JSON.stringify({
              id: 1, //id,
            })
          );
        } else {
          throw new Error(
            "Transaction failed. Received null response." +
              JSON.stringify(result)
          );
        }
      } catch (e) {
        const json = formatError(e);
        return res.status(500).send(json);
      }
    },
  },
};

async function main() {
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
