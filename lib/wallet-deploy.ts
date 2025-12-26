import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc as StellarRpc } from "@stellar/stellar-sdk";
import {
  signTransaction,
  isConnected,
  setAllowed,
  getAddress,
} from "@stellar/freighter-api";

// Explicitly use the testnet passphrase to ensure consistency
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const SOROBAN_URL = "https://soroban-testnet.stellar.org";

// Initialize server using the RPC module
const server = new StellarRpc.Server(SOROBAN_URL);

export async function deployWithWallet(
  userId: string,
  logToTerminal: (msg: string, type: string) => void
) {
  try {
    logToTerminal("Starting wallet-based deployment...", "info");

    // 1. Build contract
    const buildResponse = await fetch("/api/docker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "buildContract", userId }),
    });

    const buildData = await buildResponse.json();
    if (!buildData.success) {
      throw new Error(`Build failed: ${buildData.error}`);
    }

    logToTerminal(`✓ Contract built (${buildData.wasmSize} bytes)`, "log");

    // 2. Connect wallet
    const connectionStatus = await isConnected();
    if (!connectionStatus.isConnected) {
      logToTerminal("Requesting wallet access...", "warn");
      const access = await setAllowed();
      if (!access.isAllowed) {
        throw new Error("Wallet access denied by user");
      }
    }

    const { address } = await getAddress();
    if (!address) {
      throw new Error("Could not get wallet address");
    }

    logToTerminal(
      `Using wallet: ${address.slice(0, 6)}...${address.slice(-4)}`,
      "log"
    );

    // 3. Upload WASM
    const wasmBuffer = Buffer.from(buildData.wasmBase64, "base64");
    const account = await server.getAccount(address);

    const uploadTx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.uploadContractWasm({ wasm: wasmBuffer })
      )
      .setTimeout(30)
      .build();

    const preparedUploadTx = await server.prepareTransaction(uploadTx);
    logToTerminal("⚠️ Sign WASM upload in wallet popup...", "warn");

    const signedUploadTxXdr = await signTransaction(
      preparedUploadTx.toXDR(),
      NETWORK_PASSPHRASE
    );

    const uploadResult = await server.sendTransaction(
      StellarSdk.TransactionBuilder.fromXDR(
        signedUploadTxXdr,
        NETWORK_PASSPHRASE
      )
    );

    // 4. Wait for upload confirmation
    let uploadTxInfo;
    let attempts = 0;
    while (attempts < 60) {
      try {
        uploadTxInfo = await server.getTransaction(uploadResult.hash);
        if (uploadTxInfo.status === "SUCCESS") break;
        if (uploadTxInfo.status === "FAILED") {
          throw new Error(`Upload failed: ${uploadTxInfo.resultXdr}`);
        }
      } catch (error) {
        // Transaction not yet available, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
      if (attempts % 10 === 0)
        logToTerminal(`Waiting... (${attempts}s)`, "info");
    }

    if (!uploadTxInfo || uploadTxInfo.status !== "SUCCESS") {
      throw new Error("WASM upload timeout");
    }

    const wasmHash = uploadTxInfo.returnValue;
    if (!wasmHash) {
      throw new Error("Could not extract WASM hash from transaction");
    }

    logToTerminal(`✓ WASM uploaded (hash: ${wasmHash.toString().slice(0, 8)}...)`, "log");

    // 5. Create contract instance
    const freshAccount = await server.getAccount(address);
    const salt = StellarSdk.xdr.ScVal.scvBytes(
      Buffer.from(Date.now().toString())
    );

    const createTx = new StellarSdk.TransactionBuilder(freshAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.createContract({
          wasmHash: wasmHash,
          salt: salt,
        })
      )
      .setTimeout(30)
      .build();

    const preparedCreateTx = await server.prepareTransaction(createTx);
    logToTerminal("⚠️ Sign contract creation in wallet popup...", "warn");

    const signedCreateTxXdr = await signTransaction(
      preparedCreateTx.toXDR(),
      NETWORK_PASSPHRASE
    );

    const createResult = await server.sendTransaction(
      StellarSdk.TransactionBuilder.fromXDR(
        signedCreateTxXdr,
        NETWORK_PASSPHRASE
      )
    );

    // 6. Wait for final confirmation
    attempts = 0;
    let finalTxInfo;
    while (attempts < 60) {
      try {
        finalTxInfo = await server.getTransaction(createResult.hash);
        if (finalTxInfo.status === "SUCCESS") {
          // Extract contract ID from transaction result
          const contractId = finalTxInfo.returnValue;
          
          logToTerminal("🎉 Contract deployed!", "log");
          logToTerminal(`Contract ID: ${contractId}`, "log");
          
          return {
            success: true,
            contractId: contractId?.toString() || "unknown",
            transactionHash: createResult.hash,
          };
        }
        if (finalTxInfo.status === "FAILED") {
          throw new Error(
            `Contract creation failed: ${finalTxInfo.resultXdr}`
          );
        }
      } catch (error) {
        // Transaction not yet available, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
      if (attempts % 10 === 0)
        logToTerminal(`Waiting for confirmation... (${attempts}s)`, "info");
    }

    throw new Error("Contract creation timeout");
  } catch (err: any) {
    logToTerminal(`✗ Deployment failed: ${err.message}`, "error");
    return { success: false, error: err.message };
  }
}