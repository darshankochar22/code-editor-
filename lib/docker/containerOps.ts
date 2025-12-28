/**
 * Docker Container Operations
 * 
 * Handles creation, deletion, and health checks for Docker containers
 */

import {
  execAsync,
  getContainerName,
  getWorkspacePath,
  sleep,
} from './utils';

/**
 * Create and initialize a new Docker container
 * @param userId The user ID
 * @returns Container creation result
 */
export async function createAndInitializeContainer(userId: string) {
  try {
    const containerName = getContainerName(userId);
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
        await sleep(500);
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
    await sleep(2000);

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
        `docker exec -u developer ${containerName} sh -c "cd ${getWorkspacePath()} && stellar contract init soroban-hello-world"`,
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
      `docker exec ${containerName} test -d ${getWorkspacePath()}/soroban-hello-world && echo "exists" || echo "missing"`
    );

    if (verifyDir.trim() !== 'exists') {
      throw new Error('Contract directory was not created');
    }

    return {
      success: true,
      containerName,
      message: `Container ${containerName} created and contract initialized`,
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create container',
    };
  }
}

/**
 * Delete a Docker container
 * @param userId The user ID
 * @returns Deletion result
 */
export async function deleteContainer(userId: string) {
  try {
    const containerName = getContainerName(userId);
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
      message: `Container ${containerName} deleted`,
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete container',
    };
  }
}

/**
 * Check if a container is healthy and running
 * @param userId The user ID
 * @returns Health check result
 */
export async function checkContainerHealth(userId: string): Promise<boolean> {
  try {
    const containerName = getContainerName(userId);
    const { stdout: statusCheck } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${containerName}`
    );
    return statusCheck.trim() === 'true';
  } catch (error) {
    console.error('Health check error:', error);
    return false;
  }
}

/**
 * Ensure a container is running, throw if not
 * @param userId The user ID
 * @throws Error if container is not running
 */
export async function ensureContainerRunning(userId: string): Promise<void> {
  const isRunning = await checkContainerHealth(userId);
  if (!isRunning) {
    throw new Error(`Container for user ${userId} is not running`);
  }
}

