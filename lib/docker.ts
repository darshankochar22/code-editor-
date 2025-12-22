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

    // Run container with proper setup
    const { stdout: createOutput } = await execAsync(
      `docker run -d --name ${containerName} stellar-sandbox:v2 tail -f /dev/null`
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

    // Initialize Soroban contract
    console.log(`Initializing contract in container: ${containerName}`);
    
    try {
      const { stdout: initOutput, stderr: initError } = await execAsync(
        `docker exec ${containerName} sh -c "cd / && stellar contract init soroban-hello-world"`,
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
      `docker exec ${containerName} test -d /soroban-hello-world && echo "exists" || echo "missing"`
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

    // Get files from container - find all files recursively
    const { stdout } = await execAsync(
      `docker exec ${containerName} sh -c "find /soroban-hello-world -type f 2>/dev/null | grep -v '/target/' | grep -v '/.git/' || true"`,
      { timeout: 10000 }
    );

    const files = stdout
      .trim()
      .split('\n')
      .filter(f => f.length > 0)
      .map(f => f.replace(/^\/soroban-hello-world\//, ''))
      .filter(f => f.length > 0);

    console.log(`Found ${files.length} files`);
    return { success: true, files };
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

    // Verify file exists first
    const { stdout: fileExists } = await execAsync(
      `docker exec ${containerName} test -f /soroban-hello-world/${safePath} && echo "exists" || echo "missing"`
    );

    if (fileExists.trim() !== 'exists') {
      throw new Error('File does not exist');
    }

    // Read file from container
    const { stdout } = await execAsync(
      `docker exec ${containerName} cat /soroban-hello-world/${safePath}`,
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

    // Escape content for shell - use base64 encoding to avoid shell escaping issues
    const base64Content = Buffer.from(content).toString('base64');

    // Write file to container using base64 decoding
    await execAsync(
      `docker exec ${containerName} sh -c "echo ${escapeShellArg(base64Content)} | base64 -d > /soroban-hello-world/${safePath}"`,
      { timeout: 10000 }
    );

    // Verify file was written
    const { stdout: verifySize } = await execAsync(
      `docker exec ${containerName} wc -c < /soroban-hello-world/${safePath}`
    );

    const writtenSize = parseInt(verifySize.trim());
    const expectedSize = content.length;

    if (writtenSize !== expectedSize) {
      console.warn(`Size mismatch: written ${writtenSize}, expected ${expectedSize}`);
    }

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