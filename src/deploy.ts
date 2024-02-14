import DoinkContract from "../artifacts/optimism/Doink.sol/Doink.json" with { type: "json" };
import { Wallet, ContractFactory, Contract, JsonRpcProvider } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Optimism: https://mainnet.optimism.io 10
// Sepolia: https://rpc2.sepolia.org 11155111
const RPC = new JsonRpcProvider("https://rpc2.sepolia.org", 11155111);
if (!process.env.MNEMONIC) {
  throw new Error("`MNEMONIC` must be defined in .env.");
}
const WALLET = Wallet.fromPhrase(process.env.MNEMONIC, RPC);
// Maximum number that can be minted (set on contract init).
const MAX_DOINKS = 500;

async function deployContract(
  artifact: any,
  args: any[],
  signer: any
): Promise<Contract> {
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...args);
  if (!contract.deploymentTransaction()) {
    throw new Error("Failed to deploy contract.");
  }
  const dpTxReceipt = await contract.deploymentTransaction()!.wait();
  if (!dpTxReceipt) {
    throw new Error("Failed to deploy contract.");
  }

  console.log("Deployed contract at:", await contract.getAddress());
  console.log("Deployment tx:", dpTxReceipt.hash);
  return new Contract(await contract.getAddress(), artifact.abi, signer);
}

deployContract(DoinkContract, [WALLET.address, MAX_DOINKS], WALLET);

export {};
