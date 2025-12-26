import StellarSdk from 'stellar-sdk';
import { 
  signTransaction, 
  isConnected, 
  setAllowed, 
  getAddress 
} from '@stellar/freighter-api';

const { xdr } = StellarSdk;
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const SERVER_URL = 'https://soroban-testnet.stellar.org';
const server = new StellarSdk.Server(SERVER_URL);

export async function deployWithWallet(userId: string, logToTerminal: (msg: string, type: string) => void) {
  try {
    logToTerminal('Starting wallet-based deployment...', 'info');
    
    // 1. Build contract
    const buildResponse = await fetch('/api/container', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'buildContract', userId })
    });
    
    const buildData = await buildResponse.json();
    if (!buildData.success) {
      throw new Error(`Build failed: ${buildData.error}`);
    }
    
    logToTerminal(`✓ Contract built (${buildData.wasmSize} bytes)`, 'log');
    
    // 2. Connect wallet
    const connectionStatus = await isConnected();
    if (!connectionStatus.isConnected) {
      logToTerminal('Requesting wallet access...', 'warn');
      const access = await setAllowed();
      if (!access.isAllowed) {
        throw new Error('Wallet access denied by user');
      }
    }
    
    const { address } = await getAddress();
    if (!address) {
      throw new Error('Could not get wallet address');
    }
    
    logToTerminal(`Using wallet: ${address.slice(0, 6)}...${address.slice(-4)}`, 'log');
    
    // 3. Upload WASM
    const wasmBuffer = Buffer.from(buildData.wasmBase64, 'base64');
    const account = await server.getAccount(address);
    
    const uploadTx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE
    })
      .addOperation(StellarSdk.Operation.uploadContractWasm({ wasm: wasmBuffer }))
      .setTimeout(30)
      .build();

    const preparedUploadTx = await server.prepareTransaction(uploadTx);
    logToTerminal('⚠️ Sign WASM upload in wallet popup...', 'warn');
    
    const signedUploadTxXdr = await signTransaction(
      preparedUploadTx.toXDR(),
      NETWORK_PASSPHRASE
    );
    
    const uploadResult = await server.sendTransaction(
      StellarSdk.TransactionBuilder.fromXDR(signedUploadTxXdr, NETWORK_PASSPHRASE)
    );
    
    // 4. Wait for upload confirmation
    let uploadTxInfo;
    let attempts = 0;
    while (attempts < 60) {
      try {
        uploadTxInfo = await server.getTransaction(uploadResult.hash);
        if (uploadTxInfo.status === 'SUCCESS') break;
        if (uploadTxInfo.status === 'FAILED') {
          throw new Error(`Upload failed: ${uploadTxInfo.resultXdr}`);
        }
      } catch (error) {}
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      if (attempts % 10 === 0) logToTerminal(`Waiting... (${attempts}s)`, 'info');
    }
    
    if (!uploadTxInfo?.wasmHash) {
      throw new Error('WASM upload timeout');
    }
    
    // 5. Create contract instance
    const freshAccount = await server.getAccount(address);
    const createTx = new StellarSdk.TransactionBuilder(freshAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE
    })
      .addOperation(
        StellarSdk.Operation.createContract({
          wasmHash: uploadTxInfo.wasmHash,
          salt: xdr.ScVal.scvBytes(Buffer.from(Date.now().toString())),
        })
      )
      .setTimeout(30)
      .build();

    const preparedCreateTx = await server.prepareTransaction(createTx);
    logToTerminal('⚠️ Sign contract creation in wallet popup...', 'warn');
    
    const signedCreateTxXdr = await signTransaction(
      preparedCreateTx.toXDR(),
      NETWORK_PASSPHRASE
    );
    
    const createResult = await server.sendTransaction(
      StellarSdk.TransactionBuilder.fromXDR(signedCreateTxXdr, NETWORK_PASSPHRASE)
    );
    
    // 6. Wait for final confirmation
    attempts = 0;
    while (attempts < 60) {
      try {
        const finalTxInfo = await server.getTransaction(createResult.hash);
        if (finalTxInfo.status === 'SUCCESS') {
          logToTerminal('🎉 Contract deployed!', 'log');
          return {
            success: true,
            contractId: finalTxInfo.contractId,
            transactionHash: createResult.hash
          };
        }
        if (finalTxInfo.status === 'FAILED') {
          throw new Error(`Contract creation failed: ${finalTxInfo.resultXdr}`);
        }
      } catch (error) {}
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error('Contract creation timeout');
    
  } catch (err: any) {
    logToTerminal(`✗ Deployment failed: ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}