import { Static, Type } from "@sinclair/typebox";
import fastify, { FastifyInstance, FastifyReply } from "fastify";
import {
  Wallet,
  JsonRpcProvider,
  Interface,
  TransactionResponse,
  TransactionReceipt,
} from "ethers";
import * as dotenv from "dotenv";

import SepoliaDoinkContract from "../artifacts/sepolia/Doink.sol/Doink.json" with { type: "json" };
import OptimismDoinkContract from "../artifacts/optimism/Doink.sol/Doink.json" with { type: "json" };

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
const SUPPORTED_CHAINS = {
  // "1": { rpc: "https://eth.public-rpc.com", contract: EthereumDoinkContract },
  "10": { rpc: "https://mainnet.optimism.io", contract: OptimismDoinkContract },
  "11155111": {
    rpc: "https://rpc2.sepolia.org",
    contract: SepoliaDoinkContract,
  },
};
let CHAIN_ID = process.env.CHAIN_ID;
if (!CHAIN_ID || Object.keys(SUPPORTED_CHAINS).indexOf(CHAIN_ID) === -1) {
  console.log(
    "`CHAIN_ID` not specified in .env or not in supported chains. Supported chains: " +
      Array(Object.keys(SUPPORTED_CHAINS)).toString()
  );
  console.log("Defaulting to Sepolia.");
  CHAIN_ID = "11155111";
}

// Check to make sure Doink is deployed on desired chain.
const DOINK = SUPPORTED_CHAINS[CHAIN_ID].contract as any;
if (!DOINK.address) {
  throw new Error(
    `Address for Doink contract for chain ${CHAIN_ID} not provided. ` +
      `Please deploy Doink and add address to artifact file.`
  );
}
const IFACE = new Interface(DOINK.abi as any[]);

const RPC = new JsonRpcProvider(SUPPORTED_CHAINS[CHAIN_ID].rpc, +CHAIN_ID);
if (!process.env.MNEMONIC) {
  throw new Error("`MNEMONIC` must be defined in .env.");
}
const WALLET = Wallet.fromPhrase(process.env.MNEMONIC, RPC);

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
        const data = IFACE.encodeFunctionData("nextDoink", []);
        // Format transaction.
        const tx = {
          to: DOINK.address,
          data,
          chainId: +CHAIN_ID,
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
        const data = IFACE.encodeFunctionData("mint", [address]);
        // Format transaction.
        const tx = {
          to: DOINK.address,
          data,
          chainId: +CHAIN_ID,
        };

        // Mint the doink
        const result: TransactionResponse = await WALLET.sendTransaction(tx);
        const receipt: TransactionReceipt | null = await result.wait();
        if (receipt) {
          const id = 1;

          res.status(200).send(
            JSON.stringify({
              id,
            })
          );
          console.log(`MINTED DOINK!\nAddress: ${address}\nID: ${id}`);
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
    port: parseInt(process.env.PORT ?? "5000"),
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
