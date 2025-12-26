import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper to escape shell arguments safely
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

// Helper to escape file paths for Docker exec
function escapeFilePath(path: string): string {
  // Remove any leading slashes and ensure no path traversal
  return path.replace(/^\/+/, '').replace(/\.\./g, '');
}

export async function createAndInitializeContainer(userId: string) {
  try {
    const containerName = `user${userId}`;
    console.log(`Creating container: ${containerName}`);

    // Check if container already exists
    try {
      const { stdout: checkExists } = await execAsync(
        `docker ps -a --filter name=^${containerName}$ --format "{{.Names}}"`
      );
      if (checkExists.trim() === containerName) {
        console.log(`Container ${containerName} already exists, removing it first`);
        await deleteContainer(userId);
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      // Container doesn't exist, continue
    }

    // Run container with STELLAR_HOME set to workspace for credential storage
    const { stdout: createOutput } = await execAsync(
      `docker run -d --name ${containerName} -e STELLAR_HOME=/home/developer/workspace/.stellar stellar-sandbox:v1 tail -f /dev/null`
    );
    console.log('Container created:', createOutput.trim());

    // Wait for container to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify container is running
    const { stdout: statusCheck } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${containerName}`
    );
    
    if (statusCheck.trim() !== 'true') {
      throw new Error('Container failed to start properly');
    }

    // Initialize Soroban contract in the workspace directory
    console.log(`Initializing contract in container: ${containerName}`);
    
    try {
      const { stdout: initOutput, stderr: initError } = await execAsync(
        `docker exec -u developer ${containerName} sh -c "cd /home/developer/workspace && stellar contract init soroban-hello-world"`,
        { timeout: 30000 } // 30 second timeout
      );
      console.log('Contract initialized:', initOutput);
      if (initError) {
        console.log('Init stderr:', initError);
      }
    } catch (initError: any) {
      console.error('Contract initialization error:', initError.message);
      // Don't fail if contract already exists
      if (!initError.message.includes('already exists')) {
        throw initError;
      }
    }

    // Verify the directory was created
    const { stdout: verifyDir } = await execAsync(
      `docker exec ${containerName} test -d /home/developer/workspace/soroban-hello-world && echo "exists" || echo "missing"`
    );
    
    if (verifyDir.trim() !== 'exists') {
      throw new Error('Contract directory was not created');
    }

    return {
      success: true,
      containerName,
      message: `Container ${containerName} created and contract initialized`
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create container'
    };
  }
}

export async function deleteContainer(userId: string) {
  try {
    const containerName = `user${userId}`;
    console.log(`Deleting container: ${containerName}`);

    // Stop container (ignore errors if not running)
    try {
      await execAsync(`docker stop ${containerName}`, { timeout: 10000 });
    } catch (error) {
      console.log('Container may not be running, continuing with removal');
    }

    // Remove container (ignore errors if doesn't exist)
    try {
      await execAsync(`docker rm -f ${containerName}`);
    } catch (error) {
      console.log('Container may not exist, considering deletion successful');
    }

    console.log(`Container ${containerName} deleted`);
    return {
      success: true,
      containerName,
      message: `Container ${containerName} deleted`
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete container'
    };
  }
}

export async function generateKeys(userId: string) {
  try {
    const containerName = `user${userId}`;
    console.log(`Deploying contract in container: ${containerName}`);

    const {stdout, stderr} = await execAsync(
      `docker  exec -u developer ${containerName} sh -c "stellar keys generate darshan --network testnet--fund "`
    );
    console.log('Key generated:', stdout);
    if (stderr) {
      console.error('Key generation error:', stderr);
    }
    return {
      success: true,
      stdout,
      stderr
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to deploy contract',
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

export async function createAccount(userId: string) {
  try {
    const containerName = `user${userId}`;
    console.log(`Creating account in container: ${containerName}`);
    
    const {stdout, stderr} = await execAsync(
      `docker exec -u developer ${containerName} sh -c "stellar keys generate darshan --network testnet --fund"`,
      { timeout: 30000 }
    )
    console.log('Account created:', stdout);
    if (stderr) {
      console.error('Account creation error:', stderr);
    }

    // Copy .config folder to workspace after account creation
    console.log(`Copying .config folder to workspace...`);
    try {
      await execAsync(
        `docker exec ${containerName} cp -r /home/developer/.config /home/developer/workspace/soroban-hello-world/.config`,
        { timeout: 10000 }
      );
      console.log('.config folder copied to workspace');
    } catch (copyError: any) {
      console.error('Warning: Failed to copy .config folder:', copyError.message);
      // Don't fail the account creation if copy fails
    }

    return {
      success: true,
      stdout,
      stderr,
      message: 'Account created and credentials backed up'
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create account',
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

export async function deployContract(userId: string, publicKey?: string){
  try {
    const containerName = `user${userId}`;
    console.log(`Deploying contract in container: ${containerName}`);
    
    // Build the deployment command with optional publicKey parameter
    // Note: --source-account is always required (the account that pays for deployment)
    // --sign-with-key is optional (the key used to sign the transaction)
    const deployCmd = publicKey
      ? `stellar contract deploy --wasm target/wasm32v1-none/release/hello_world.wasm --source-account darshan --network testnet --alias hello_world`
      : `stellar contract deploy --wasm target/wasm32v1-none/release/hello_world.wasm --source-account darshan --network testnet --alias hello_world`;
    
    const {stdout, stderr} = await execAsync(
      `docker exec -u developer -w /home/developer/workspace/soroban-hello-world ${containerName} sh -c "stellar contract build && cargo build --target wasm32v1-none --release && ${deployCmd}"`,
      { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
    );
    
    // Log both outputs
    console.log('=== STDOUT ===');
    console.log(stdout || '(empty)');
    console.log('=== STDERR ===');
    console.log(stderr || '(empty)');
    
    // Combine stdout and stderr for the output
    const output = (stdout || '') + (stderr || '');
    
    return {
      success: true,
      message: 'Contract deployed successfully',
      output: output,  // Send full terminal output
      stdout,
      stderr
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    console.log('=== ERROR STDOUT ===');
    console.log(error.stdout || '(empty)');
    console.log('=== ERROR STDERR ===');
    console.log(error.stderr || '(empty)');
    
    return {
      success: false,
      error: error.message || 'Failed to deploy contract',
      output: (error.stdout || '') + (error.stderr || ''),
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

export async function getContainerFiles(userId: string) {
  try {
    const containerName = `user${userId}`;
    console.log(`Getting files from container: ${containerName}`);

    // Verify container is running
    const { stdout: statusCheck } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${containerName} 2>/dev/null || echo "false"`
    );
    
    if (statusCheck.trim() !== 'true') {
      throw new Error('Container is not running');
    }

    // Get files from the workspace directory
    const projectPath = '/home/developer/workspace/soroban-hello-world';
    
    // Check if project exists
    const { stdout: projectExists } = await execAsync(
      `docker exec ${containerName} test -d ${projectPath} && echo "exists" || echo "missing"`
    );

    if (projectExists.trim() !== 'exists') {
      return { 
        success: true, 
        files: [],
        message: 'Project not initialized yet. Click "Create Container" to initialize.'
      };
    }

    // Get files from container - find all files recursively
    const { stdout } = await execAsync(
      `docker exec ${containerName} find ${projectPath} -type f 2>/dev/null`,
      { timeout: 10000 }
    );

    // Parse the output and filter out unwanted paths
    const allFiles = stdout
      .trim()
      .split('\n')
      .filter(f => f.length > 0)
      .map(f => f.replace(`${projectPath}/`, ''))
      // Filter out build artifacts
      .filter(f => !f.includes('/target/') && !f.includes('/.git/') && f !== 'Cargo.lock');

    console.log(`Found ${allFiles.length} files in ${projectPath}`);
    console.log('Files list:', allFiles);
    return { success: true, files: allFiles };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get files',
      files: []
    };
  }
}

export async function getFileContent(userId: string, filePath: string) {
  try {
    const containerName = `user${userId}`;
    const safePath = escapeFilePath(filePath);
    console.log(`Reading file: ${safePath} from container: ${containerName}`);

    const fullPath = `/home/developer/workspace/soroban-hello-world/${safePath}`;
    console.log(`Full path for reading: ${fullPath}`);

    // Verify file exists first
    const { stdout: fileExists } = await execAsync(
      `docker exec ${containerName} test -f ${fullPath} && echo "exists" || echo "missing"`
    );

    if (fileExists.trim() !== 'exists') {
      console.error(`File not found: ${fullPath}`);
      throw new Error(`File does not exist at ${fullPath}`);
    }

    // Read file from container
    const { stdout } = await execAsync(
      `docker exec ${containerName} cat ${fullPath}`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB max file size
    );

    return { success: true, content: stdout };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to read file',
      content: ''
    };
  }
}

export async function saveFileContent(userId: string, filePath: string, content: string) {
  try {
    const containerName = `user${userId}`;
    const safePath = escapeFilePath(filePath);
    console.log(`Saving file: ${safePath} to container: ${containerName}`);

    const fullPath = `/home/developer/workspace/soroban-hello-world/${safePath}`;
    console.log(`Full path: ${fullPath}`);

    // First verify the file exists
    const { stdout: fileCheck } = await execAsync(
      `docker exec ${containerName} test -f ${fullPath} && echo "exists" || echo "missing"`
    );
    
    if (fileCheck.trim() === 'missing') {
      console.error(`File not found at: ${fullPath}`);
      // Try to show what files exist
      const { stdout: dirContents } = await execAsync(
        `docker exec ${containerName} find /home/developer/workspace/soroban-hello-world -name "lib.rs" 2>/dev/null || true`
      );
      console.log('Found lib.rs at:', dirContents);
      return {
        success: false,
        error: `File not found at ${fullPath}. Try refreshing the file tree.`
      };
    }

    // Escape content for shell - use base64 encoding to avoid shell escaping issues
    const base64Content = Buffer.from(content).toString('base64');

    // Write file to container using base64 decoding
    await execAsync(
      `docker exec -u developer ${containerName} sh -c "echo ${escapeShellArg(base64Content)} | base64 -d > ${fullPath}"`,
      { timeout: 10000 }
    );

    console.log('File saved successfully');
    return { success: true, message: 'File saved' };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to save file'
    };
  }
}

// Additional utility function to execute commands in the container
export async function executeCommand(userId: string, command: string) {
  try {
    const containerName = `user${userId}`;
    console.log(`Executing command in container ${containerName}: ${command}`);

    const { stdout, stderr } = await execAsync(
      `docker exec -u developer -w /home/developer/workspace/soroban-hello-world ${containerName} sh -c ${escapeShellArg(command)}`,
      { timeout: 60000 } // 60 second timeout for builds
    );

    return {
      success: true,
      stdout,
      stderr
    };
  } catch (error: any) {
    console.error('Command execution error:', error);
    return {
      success: false,
      error: error.message || 'Failed to execute command',
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

export async function createFile(userId: string, filePath: string) {
  try {
    const containerName = `user${userId}`;
    const safePath = escapeFilePath(filePath);
    console.log(`Creating file: ${safePath} in container: ${containerName}`);

    const fullPath = `/home/developer/workspace/soroban-hello-world/${safePath}`;

    // Create parent directory if it doesn't exist
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dirPath) {
      await execAsync(
        `docker exec -u developer ${containerName} mkdir -p ${escapeShellArg(dirPath)}`,
        { timeout: 5000 }
      );
    }

    // Create empty file
    await execAsync(
      `docker exec -u developer ${containerName} touch ${escapeShellArg(fullPath)}`,
      { timeout: 5000 }
    );

    console.log('File created successfully');
    return { success: true, message: 'File created' };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create file'
    };
  }
}

export async function createFolder(userId: string, folderPath: string) {
  try {
    const containerName = `user${userId}`;
    const safePath = escapeFilePath(folderPath);
    console.log(`Creating folder: ${safePath} in container: ${containerName}`);

    const fullPath = `/home/developer/workspace/soroban-hello-world/${safePath}`;

    // Create directory
    await execAsync(
      `docker exec -u developer ${containerName} mkdir -p ${escapeShellArg(fullPath)}`,
      { timeout: 5000 }
    );

    console.log('Folder created successfully');
    return { success: true, message: 'Folder created' };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create folder'
    };
  }
}

export async function deleteFile(userId: string, filePath: string) {
  try {
    const containerName = `user${userId}`;
    const safePath = escapeFilePath(filePath);
    console.log(`Deleting file: ${safePath} in container: ${containerName}`);

    const fullPath = `/home/developer/workspace/soroban-hello-world/${safePath}`;
    await execAsync(
      `docker exec -u developer ${containerName} rm -f ${escapeShellArg(fullPath)}`,
      { timeout: 5000 }
    );
    console.log('File deleted successfully');
    return { success: true, message: 'File deleted' };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete file'
    };
  }
}

export async function deleteFolder(userId: string, folderPath: string) {
  try {
    const containerName = `user${userId}`;
    const safePath = escapeFilePath(folderPath);
    console.log(`Deleting folder: ${safePath} in container: ${containerName}`);

    const fullPath = `/home/developer/workspace/soroban-hello-world/${safePath}`;
    await execAsync(
      `docker exec -u developer ${containerName} rm -rf ${escapeShellArg(fullPath)}`,
      { timeout: 5000 }
    );
    console.log('Folder deleted successfully');
    return { success: true, message: 'Folder deleted' };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete folder'
    };
  }
} 


export async function buildContract(userId: string) {
  try {
    const containerName = `user${userId}`;
    console.log(`Building contract in container: ${containerName}`);
    
    // 1. Build the contract
    const { stdout, stderr } = await execAsync(
      `docker exec -u developer -w /home/developer/workspace/soroban-hello-world ${containerName} sh -c "stellar contract build && cargo build --target wasm32v1-none --release"`,
      { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
    );

    console.log('Build stdout:', stdout);
    if (stderr) console.log('Build stderr:', stderr);

    // 2. Get the WASM file path
    const wasmPath = '/home/developer/workspace/soroban-hello-world/target/wasm32v1-none/release/hello_world.wasm';
    
    // 3. Check if WASM file exists
    const { stdout: fileCheck } = await execAsync(
      `docker exec ${containerName} test -f ${wasmPath} && echo "exists" || echo "missing"`
    );

    if (fileCheck.trim() !== 'exists') {
      console.error('WASM file not found at:', wasmPath);
      throw new Error('WASM file not found after build');
    }

    // 4. Read the WASM file and convert to base64
    const { stdout: wasmBase64 } = await execAsync(
      `docker exec ${containerName} cat ${wasmPath} | base64`,
      { maxBuffer: 20 * 1024 * 1024 }
    );

    // 5. Get file size for logging
    const { stdout: wasmSize } = await execAsync(
      `docker exec ${containerName} wc -c < ${wasmPath}`
    );

    console.log(`WASM file built: ${wasmSize.trim()} bytes, base64 length: ${wasmBase64.length}`);

    return {
      success: true,
      wasmBase64: wasmBase64.trim(), // The contract as base64-encoded string
      wasmSize: parseInt(wasmSize.trim()) || 0,
      buildOutput: stdout + (stderr || '')
    };
  } catch (error: any) {
    console.error('Build error:', error);
    return {
      success: false,
      error: error.message,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      buildOutput: (error.stdout || '') + (error.stderr || '')
    };
  }
}
